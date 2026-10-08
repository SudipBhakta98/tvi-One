import express from "express";import {addProductionEntry,getProjectProduction,setProductionQcStatus,getAllProduction} from "../controllers/productionController.js";
const r=express.Router();r.get("/",getAllProduction);r.post("/",addProductionEntry);r.get("/project/:projectID",getProjectProduction);r.patch("/:productionID/qc",setProductionQcStatus);export default r;
