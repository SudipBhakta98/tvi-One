import Machine from "../models/machineModel.js";

export const listMachines = async (req, res) => {
  const filter = req.query.includeInactive ? {} : { isActive: true };
  res.json(await Machine.find(filter).select("name code description isActive").sort({ name: 1 }).lean());
};

export const createMachine = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const machine = await Machine.create({ name, code, description });
    res.status(201).json({ success: true, machine });
  } catch (e) {
    res.status(400).json({ error: e.code === 11000 ? "A machine with this name already exists" : e.message });
  }
};

export const updateMachine = async (req, res) => {
  try {
    const { name, code, description, isActive } = req.body;
    const machine = await Machine.findByIdAndUpdate(
      req.params.machineID,
      { name, code, description, isActive },
      { new: true, runValidators: true },
    );
    if (!machine) return res.status(404).json({ error: "Machine not found" });
    res.json({ success: true, machine });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
