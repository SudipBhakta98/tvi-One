import mongoose from "mongoose";
const grnSchema=new mongoose.Schema({purchase_order:{type:mongoose.Schema.Types.ObjectId,ref:"PurchaseOrder",required:true},invoice_number:String,received_qty:{type:Number,required:true,min:1},accepted_qty:{type:Number,default:0,min:0},rejected_qty:{type:Number,default:0,min:0},received_date:{type:Date,required:true},quality_status:{type:String,enum:["PENDING","ACCEPTED","PARTIAL","REJECTED"],default:"PENDING"},quality_notes:String},{timestamps:true});
grnSchema.index({ received_date: -1, quality_status: 1 });
grnSchema.index({ purchase_order: 1, received_date: -1 });

export default mongoose.model("GRN",grnSchema);
