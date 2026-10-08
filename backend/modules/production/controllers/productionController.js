import Production from "../models/productionModel.js";
import Stage from "../models/stageModel.js";

const productionFields = "project date finished_qty qc_status qc_notes stage machine operator_name start_time end_time";

export const addProductionEntry = async (req, res) => {
  try {
    const { project, date, finished_qty, qc_notes, stage, machine, operator_name, start_time, end_time } = req.body;
    if (!project || !date || !finished_qty || !operator_name || !start_time || !end_time) return res.status(400).json({ error: "project, date, finished_qty, operator_name, start_time and end_time are required" });
    if (!stage && !machine) return res.status(400).json({ error: "Select a stage or a machine" });
    if (stage && machine) {
      const valid = await Stage.exists({ _id: stage, machines: machine, isActive: true });
      if (!valid) return res.status(400).json({ error: "Machine is not assigned to the selected stage" });
    }
    const production = await Production.create({ project, date, finished_qty, qc_notes, stage, machine, operator_name, start_time, end_time });
    res.status(201).json({ success: true, production });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

export const getProjectProduction = async (req, res) => res.json(await Production.find({ project: req.params.projectID }).select(productionFields).populate("stage machine", "name code").sort({ date: 1 }).lean());

export const setProductionQcStatus = async (req, res) => {
  try {
    const { qc_status, qc_notes } = req.body;
    if (!["PASSED", "FAILED"].includes(qc_status)) return res.status(400).json({ error: "qc_status must be PASSED or FAILED" });
    const production = await Production.findByIdAndUpdate(req.params.productionID, { qc_status, qc_notes }, { new: true, runValidators: true }).select(productionFields).populate("stage machine", "name code").lean();
    if (!production) return res.status(404).json({ error: "Production entry not found" });
    res.json({ success: true, production });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

export const getAllProduction = async (req, res) => res.json(await Production.find().select(productionFields).populate("project", "project_name customer").populate("stage machine", "name code").sort({ date: -1 }).lean());
