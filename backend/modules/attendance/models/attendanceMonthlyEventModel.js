import mongoose from "mongoose";

const offenderSchema = [{ employeeCode: String, employeeName: String, company: String, department: String, unit: String, dates: [String] }];

const schema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true }, // MM-YYYY
    absentEmployees: offenderSchema,
    lateEntryEmployees: offenderSchema,
    earlyExitEmployees: offenderSchema,
    missPunchEmployees: offenderSchema,
  },
  { timestamps: true },
);

export default mongoose.model("AttendanceMonthlyEvent", schema);
