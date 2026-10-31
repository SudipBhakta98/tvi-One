import mongoose from "mongoose";

const absentEmployeeSchema = { employeeCode: String, employeeName: String, company: String, department: String, unit: String };

const schema = new mongoose.Schema(
  {
    reportDate: { type: String, required: true, unique: true, index: true },
    totalPresent: Number,
    totalAbsent: Number,
    unitWise: Object,
    departmentWise: Object,
    companyWise: Object,
    absentEmployees: [absentEmployeeSchema],
    expiresAt: { type: Date, default: Date.now, expires: "24h" }, // today's live feed is deleted 24h after creation
  },
  { timestamps: true },
);

export default mongoose.model("AttendanceTodayReport", schema);
