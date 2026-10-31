import Counter from "../models/counterModel.js";

/** Atomically increments a persistent counter. Retries the rare simultaneous-upsert duplicate-key race. */
export async function incrementCounter(key) {
  try {
    return await Counter.findOneAndUpdate(
      { _id: key },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return Counter.findOneAndUpdate(
      { _id: key },
      { $inc: { sequence: 1 } },
      { new: true, upsert: false }
    );
  }
}
