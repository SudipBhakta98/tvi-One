import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  { present: { type: Number, default: 0 }, absent: { type: Number, default: 0 }, lateEntry: { type: Number, default: 0 }, earlyExit: { type: Number, default: 0 }, missPunch: { type: Number, default: 0 } },
  { _id: false },
);

const employeeSchema = new mongoose.Schema(
  {
    employeeCode: String, employeeName: String, company: String, department: String, unit: String,
    shift: String, inPunch: String, outPunch: String, workingHours: Number, attendanceStatus: String,
    status: [{ type: String, enum: ["Late Entry", "Early Exit", "Miss Punch"] }],
    remarks: [String],
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    isoDate: { type: String, required: true, unique: true, index: true },
    date: { type: String, required: true, unique: true, index: true }, // DD-MM-YYYY
    totalPresent: { type: Number, default: 0 },
    totalAbsent: { type: Number, default: 0 },
    unitWise: { type: Map, of: counterSchema, default: {} },
    departmentWise: { type: Map, of: counterSchema, default: {} },
    companyWise: { type: Map, of: counterSchema, default: {} },
    absentEmployees: [employeeSchema],
    lateEntryEmployees: [employeeSchema],
    earlyExitEmployees: [employeeSchema],
    missPunchEmployees: [employeeSchema],
  },
  { timestamps: true },
);

export default mongoose.model("AttendancePreviousDayReport", schema);
