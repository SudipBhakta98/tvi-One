import Component from "../models/componentModel.js";
import RfqItem from "../models/rfqItemModel.js";
import Project from "../../project/models/projectModel.js";

const validBomStage = ["PILOT", "FINAL_BOM"];

export const addComponent = async (req, res) => {
  try {
    const { project, rfq_item, component_name, component_description, per_unit_qty, total_qty, bom_stage } = req.body;
    if ((!project && !rfq_item) || (project && rfq_item)) return res.status(400).json({ error: "Provide exactly one of project or rfq_item" });
    if (!component_name?.trim() || !per_unit_qty || !total_qty) return res.status(400).json({ error: "component_name, per_unit_qty, total_qty are required" });
    if (!validBomStage.includes(bom_stage)) return res.status(400).json({ error: "bom_stage must be PILOT or FINAL_BOM" });

    if (rfq_item) {
      const r = await RfqItem.findById(rfq_item);
      if (!r) return res.status(404).json({ error: "RFQ not found" });

      if (bom_stage === "PILOT" && r.current_stage !== "CAPEX_PILOT_COMPONENTS") {
        return res.status(400).json({ error: "Pilot components can only be defined during Capex / Pilot Components stage" });
      }
      if (bom_stage === "FINAL_BOM" && r.current_stage !== "ACTUAL_BOM") {
        return res.status(400).json({ error: "Final BOM can only be defined while the Define Actual BOM stage is open" });
      }
    }

    if (project) {
      const projectExists = await Project.exists({ _id: project });
      if (!projectExists) return res.status(404).json({ error: "Project not found" });
      if (bom_stage !== "FINAL_BOM") return res.status(400).json({ error: "Project components must be final BOM components" });
    }

    const c = await Component.create({
      project, rfq_item, component_name: component_name.trim(), component_description,
      per_unit_qty, total_qty, bom_stage,
    });
    res.status(201).json({ success: true, component: c });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

export const getComponentById = async (req, res) => {
  const c = await Component.findById(req.params.componentID);
  if (!c) return res.status(404).json({ error: "Component not found" });
  res.json(c);
};

export const getProjectComponents = async (req, res) => res.json(await Component.find({ project: req.params.projectID }).sort({ createdAt: 1 }));
export const getRfqComponents = async (req, res) => res.json(await Component.find({ rfq_item: req.params.rfqItemID }).sort({ bom_stage: 1, createdAt: 1 }));

export const editComponent = async (req, res) => {
  try {
    const c = await Component.findById(req.params.componentID);
    if (!c) return res.status(404).json({ error: "Component not found" });
    if (c.rfq_item) {
      const r = await RfqItem.findById(c.rfq_item);
      if (c.bom_stage === "PILOT" && r?.current_stage !== "CAPEX_PILOT_COMPONENTS") return res.status(400).json({ error: "Pilot components can only be edited during Capex / Pilot Components stage" });
      if (c.bom_stage === "FINAL_BOM" && r?.current_stage !== "ACTUAL_BOM") return res.status(400).json({ error: "Final BOM can only be edited while the Define Actual BOM stage is open" });
    }
    delete req.body.project; delete req.body.rfq_item; delete req.body.bom_stage;
    Object.assign(c, req.body);
    await c.save();
    res.json({ success: true, component: c });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

export const deleteComponent = async (req, res) => {
  try {
    const c = await Component.findById(req.params.componentID);
    if (!c) return res.status(404).json({ error: "Component not found" });
    if (c.rfq_item) {
      const r = await RfqItem.findById(c.rfq_item);
      if (c.bom_stage === "PILOT" && r?.current_stage !== "CAPEX_PILOT_COMPONENTS") return res.status(400).json({ error: "Pilot components can only be deleted during Capex / Pilot Components stage" });
      if (c.bom_stage === "FINAL_BOM" && r?.current_stage !== "ACTUAL_BOM") return res.status(400).json({ error: "Final BOM can only be deleted while the Define Actual BOM stage is open" });
    }
    await c.deleteOne();
    res.json({ success: true, message: "Component deleted" });
  } catch (e) { res.status(400).json({ error: e.message }); }
};
