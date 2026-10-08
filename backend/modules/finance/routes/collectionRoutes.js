import express from "express";
import { createCollection } from "../controllers/collectionController/createCollection.js";
import { updateCollection } from "../controllers/collectionController/updateCollection.js";
import { updateCollectionStatus } from "../controllers/collectionController/updateCollectionStatus.js";
import { deleteCollection } from "../controllers/collectionController/deleteCollection.js";
import { getCollections } from "../controllers/collectionController/getCollections.js";

const collectionRoutes = express.Router();

collectionRoutes.get("/getCollections", getCollections);
collectionRoutes.post("/createCollection", createCollection);
collectionRoutes.put("/updateCollection/:collectionId", updateCollection);
collectionRoutes.patch("/updateCollectionStatus/:collectionId", updateCollectionStatus);
collectionRoutes.delete("/deleteCollection/:collectionId", deleteCollection);

export default collectionRoutes;
