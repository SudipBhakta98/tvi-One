import Project from "../../project/models/projectModel.js";
import Component from "../models/componentModel.js";

// Runs once, the moment mass production is approved (mass_production.status
// becomes "HANDED_OVER"). Creates the Project, then hands over every
// Component that was selected for this rfq_item during Prototype — no
// duplication, they just get re-owned from the RFQ to the new Project.
const convertRfqToProject = async (rfqItem) => {
  if (rfqItem.linked_project) {
    return Project.findById(rfqItem.linked_project);
  }

  const orderQty = rfqItem.purchase_order?.po_qty || rfqItem.volume_per_annum_nos;
  const poSchedule = (rfqItem.purchase_order?.delivery_schedule || []).map(({ date, quantity }) => ({ date, delivery_qty: quantity }));
  const deliveryDate =
    rfqItem.mass_production?.handover_target_date || rfqItem.rfq_target_date || new Date();

  const project = await Project.create({
    project_name: rfqItem.project_name,
    project_owner: rfqItem.project_lead,
    customer: rfqItem.customer,
    order_qty: orderQty,
    delivery_schedule: poSchedule.length ? poSchedule : [{ date: deliveryDate, delivery_qty: orderQty }],
    source_rfq: rfqItem._id,
  });

  await Component.updateMany(
    { rfq_item: rfqItem._id },
    { $set: { project: project._id }, $unset: { rfq_item: "" } },
  );

  rfqItem.linked_project = project._id;
  await rfqItem.save();

  return project;
};

export default convertRfqToProject;
