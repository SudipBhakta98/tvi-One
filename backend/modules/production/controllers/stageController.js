import Stage from "../models/stageModel.js";

const projection = "name code description machines isActive";
const cleanMachines = (ids) => [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean).map(String))];

export const listStages = async (req, res) => {
  try {
    const filter = req.query.includeInactive ? {} : { isActive: true };
    res.json(await Stage.find(filter).select(projection).populate("machines", "name code").sort({ name: 1 }).lean());
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createStage = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    const stage = await Stage.create({ name, code, description, machines: cleanMachines(req.body.machines) });
    res.status(201).json({ success: true, stage: await stage.populate("machines", "name code") });
  } catch (e) { res.status(400).json({ error: e.code === 11000 ? "A stage with this name already exists" : e.message }); }
};

export const updateStage = async (req, res) => {
  try {
    const { name, code, description, isActive } = req.body;
    const update = { name, code, description, isActive };
    if (Array.isArray(req.body.machines)) update.machines = cleanMachines(req.body.machines);
    const stage = await Stage.findByIdAndUpdate(req.params.stageID, update, { new: true, runValidators: true }).populate("machines", "name code");
    if (!stage) return res.status(404).json({ error: "Stage not found" });
    res.json({ success: true, stage });
  } catch (e) { res.status(400).json({ error: e.message }); }
};
