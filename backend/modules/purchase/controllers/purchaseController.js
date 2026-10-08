import PurchaseOrder from "../models/purchaseOrderModel.js";
import Component from "../../rfq/models/componentModel.js";
import RfqItem from "../../rfq/models/rfqItemModel.js";
import Project from "../../project/models/projectModel.js";

export const createPurchaseOrder = async (req, res) => {
  try {
    const { purchase_type, project, component, rfq_item, item_name } = req.body;

    if (purchase_type === "PRODUCTION") {
      if (!project || !component) {
        return res.status(400).json({ error: "project and component are required for a production purchase order" });
      }
      const componentExists = await Component.findOne({ _id: component, project });
      if (!componentExists) return res.status(404).json({ error: "Component not found in this project" });
    } else if (purchase_type === "RFQ_NPD") {
      if (!rfq_item) return res.status(400).json({ error: "rfq_item is required for an RFQ/NPD purchase order" });
      if (!component && !item_name) {
        return res.status(400).json({ error: "Provide a component or an item_name for an RFQ/NPD purchase order" });
      }
      const rfqItemExists = await RfqItem.findById(rfq_item);
      if (!rfqItemExists) return res.status(404).json({ error: "RFQ item not found" });
    } else {
      return res.status(400).json({ error: "purchase_type must be RFQ_NPD or PRODUCTION" });
    }

    if (purchase_type === "PRODUCTION") {
      const projectRecord = await Project.findById(project);
      if (!projectRecord || projectRecord.status !== "ACTIVE") return res.status(400).json({ error: "Production PO requires an active project" });
    }
    const purchaseOrder = await PurchaseOrder.create(req.body);
    return res.status(201).json({ message: "Purchase order created", purchaseOrder });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

export const getAllPurchaseOrders = async (req, res) => {
  try {
    const { purchase_type, status, supplier, po_number, project, rfq_item } = req.query;
    const filter = {};
    if (purchase_type) filter.purchase_type = purchase_type;
    if (status) filter.status = status;
    if (supplier) filter.supplier = { $regex: supplier, $options: "i" };
    if (po_number) filter.po_number = { $regex: po_number, $options: "i" };
    if (project) filter.project = project;
    if (rfq_item) filter.rfq_item = rfq_item;
    const purchaseOrders = await PurchaseOrder.find(filter)
      .populate("project", "project_name")
      .populate("component", "component_name");
    return res.status(200).json(purchaseOrders);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getProjectPurchaseOrders = async (req, res) => {
  try {
    const purchaseOrders = await PurchaseOrder.find({ project: req.params.projectID }).populate(
      "component",
      "component_name",
    );
    return res.status(200).json(purchaseOrders);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// RFQ/NPD purchases — sample or trial material bought before a project exists.
export const getRfqPurchaseOrders = async (req, res) => {
  try {
    const purchaseOrders = await PurchaseOrder.find({ rfq_item: req.params.rfqItemID }).populate(
      "component",
      "component_name",
    );
    return res.status(200).json(purchaseOrders);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const getPurchaseOrderById = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.purchaseOrderID)
      .populate("project")
      .populate("component")
      .populate("rfq_item");
    if (!purchaseOrder) return res.status(404).json({ error: "Purchase order not found" });
    return res.status(200).json(purchaseOrder);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const editPurchaseOrder = async (req, res) => {
  try {
    const updates = req.body;
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Update fields are required" });
    }
    const updatedPurchaseOrder = await PurchaseOrder.findByIdAndUpdate(
      req.params.purchaseOrderID,
      updates,
      { new: true, runValidators: true },
    );
    if (!updatedPurchaseOrder) return res.status(404).json({ error: "Purchase order not found" });
    return res.status(200).json({ message: "Purchase order updated", purchaseOrder: updatedPurchaseOrder });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const deletePurchaseOrder = async (req, res) => {
  try {
    const deleted = await PurchaseOrder.findByIdAndDelete(req.params.purchaseOrderID);
    if (!deleted) return res.status(404).json({ error: "Purchase order not found" });
    return res.status(200).json({ message: "Purchase order deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
