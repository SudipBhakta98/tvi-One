import Payable from "../../models/payableModel.js";

const TOTAL_TOLERANCE = 1;

const round2 = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// Accepts 18 (percent) or 0.18 (fraction) and always returns a fraction (0.18).
// Anything above 1 is treated as a percent.
const normalizeGstRate = (raw) => {
  if (raw === "" || raw === null || raw === undefined) return NaN;
  const n = Number(raw);
  if (Number.isNaN(n)) return NaN;
  return n > 1 ? n / 100 : n;
};

const parseFlexibleDate = (rawDate) => {
  if (!rawDate) return null;

  let d = new Date(rawDate);
  if (!isNaN(d.getTime())) return d;

  if (typeof rawDate === "string") {
    const parts = rawDate.split(/[-/]/);
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      if (day && month && year) {
        d = new Date(year, month - 1, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }

  const numericDate = Number(rawDate);
  if (!isNaN(numericDate) && numericDate > 20000) {
    d = new Date(Math.round((numericDate - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d;
  }

  return null;
};

export const createPayable = async (req, res) => {
  try {
    let payload = req.body;

    if (payload && Array.isArray(payload.invoices)) {
      payload = payload.invoices;
    }

    const isBulk = Array.isArray(payload);
    const itemsToProcess = isBulk ? payload : payload ? [payload] : [];

    if (itemsToProcess.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one invoice.",
      });
    }

    const createdBy = req.user?._id;

    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: "Your login session is invalid. Please log in again.",
      });
    }

    const existingRecords = await Payable.find(
      {},
      { invoiceNumber: 1, grnNumber: 1, _id: 0 }
    ).lean();

    const existingSet = new Set(
      existingRecords.map((doc) => `${doc.invoiceNumber}_${doc.grnNumber}`)
    );

    const validDocuments = [];
    const invalidItems = [];
    const seenInBatch = new Set();

    itemsToProcess.forEach((item, index) => {
      const itemIndex = index + 1;
      const errors = [];

      const invoiceNumber = item.invoiceNumber
        ? String(item.invoiceNumber).trim()
        : "";

      const grnNumber =
        item.grnNumber !== undefined && item.grnNumber !== null
          ? String(item.grnNumber).trim()
          : "";

      const supplierName = item.supplierName
        ? String(item.supplierName).trim()
        : "";

      const parsedInvoiceDate = parseFlexibleDate(item.invoiceDate);

      const subTotal = Number(item.subTotal);

      // Always a fraction here, e.g. 0.18 (works for both 18 and 0.18 input)
      const gstRate = normalizeGstRate(item.gstRate);

      // TDS rate is kept as a percent (e.g. 2 = 2%)
      let tdsRate = item.tdsRate !== undefined ? Number(item.tdsRate) : 0;
      if (!isNaN(tdsRate) && tdsRate > 0 && tdsRate <= 1) {
        tdsRate = Math.round(tdsRate * 100 * 10000) / 10000; // fraction -> percent, 4 decimals
      }

      const totalAmount = Number(item.totalAmount);

      // Basic validations
      if (!invoiceNumber) errors.push("Invoice number is required.");
      if (!grnNumber) errors.push("GRN number is required.");
      if (!supplierName) errors.push("Supplier name is required.");
      if (!parsedInvoiceDate) errors.push("Please provide a valid invoice date.");
      if (isNaN(subTotal) || subTotal < 0) errors.push("Sub-total must be a valid amount.");
      if (isNaN(gstRate) || gstRate < 0 ) {
        errors.push("GST rate can't be less than 0.");
      }
      if (isNaN(tdsRate) || tdsRate < 0 || tdsRate > 100) {
        errors.push("TDS rate must be between 0% and 100%.");
      }
      if (isNaN(totalAmount) || totalAmount < 0) errors.push("Total amount must be a valid amount.");

      // Duplicate check
      if (invoiceNumber && grnNumber) {
        const compositeKey = `${invoiceNumber}_${grnNumber}`;

        if (existingSet.has(compositeKey)) {
          errors.push(`An invoice with Invoice Number '${invoiceNumber}' and GRN Number '${grnNumber}' already exists.`);
        } else if (seenInBatch.has(compositeKey)) {
          errors.push(`Invoice Number '${invoiceNumber}' and GRN Number '${grnNumber}' are repeated in this request.`);
        } else {
          seenInBatch.add(compositeKey);
        }
      }

      // GST calculation (fraction rate, keeps paise)
      let gstAmount = 0;
      if (!isNaN(subTotal) && !isNaN(gstRate)) {
        gstAmount = round2(subTotal * gstRate);
      }

      // Total amount check
      if (!isNaN(subTotal) && !isNaN(gstRate) && !isNaN(totalAmount)) {
        const expectedTotalAmount = round2(subTotal + gstAmount);

        if (Math.abs(totalAmount - expectedTotalAmount) > TOTAL_TOLERANCE) {
          errors.push(`Total amount (₹${totalAmount}) does not match Sub-total + GST calculation (₹${expectedTotalAmount}).`);
        }
      }

      if (errors.length > 0) {
        invalidItems.push({
          index: itemIndex,
          invoiceNumber: invoiceNumber || "N/A",
          grnNumber: grnNumber || "N/A",
          supplierName: supplierName || "N/A",
          rawItem: item, // Original input object preserved for client inspection
          errors,
        });
        return;
      }

      // TDS rate is a percent, so divide by 100
      const tdsAmount = round2((subTotal * tdsRate) / 100);
      const payableAmount = Math.max(0, round2(totalAmount - tdsAmount));

      validDocuments.push({
        invoiceNumber,
        grnNumber,
        supplierName,
        invoiceDate: parsedInvoiceDate,
        subTotal,
        gstRate,
        gstAmount,
        totalAmount,
        tdsRate,
        tdsAmount,
        payableAmount,
        createdBy,
        updateLogs: [],
      });
    });

    if (!isBulk) {
      if (invalidItems.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Please correct invoice details and try again.",
          errors: invalidItems[0].errors,
          failedInvoice: invalidItems[0],
        });
      }

      const newPayable = new Payable(validDocuments[0]);
      await newPayable.save();

      return res.status(201).json({
        success: true,
        message: "Payable invoice created successfully.",
        data: newPayable,
      });
    }

    let insertedDocs = [];
    if (validDocuments.length > 0) {
      insertedDocs = await Payable.insertMany(validDocuments, { ordered: false });
    }

    return res
      .status(invalidItems.length > 0 && insertedDocs.length === 0 ? 400 : 200)
      .json({
        success: true,
        message: `Bulk processing completed. ${insertedDocs.length} invoice(s) created successfully.`,
        summary: {
          totalReceived: itemsToProcess.length,
          successfullyInserted: insertedDocs.length,
          failedCount: invalidItems.length,
        },
        failedInvoices: invalidItems,
      });
  } catch (error) {
    console.error("Error in createPayable controller:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while creating the payable invoice.",
    });
  }
};