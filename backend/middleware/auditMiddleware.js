import AuditLog from "../modules/admin/auditLogModel.js";
export const auditRequest = (req, res, next) => {
  res.on("finish", () => {
    if (req.user && req.method !== "GET") {
      AuditLog.create({
        user: req.user._id,
        action: `${req.method}_${req.originalUrl}`,
        resource: req.originalUrl.split("/")[2],
        resourceId:
          req.params?.rfqItemID ||
          req.params?.projectID ||
          req.params?.purchaseOrderID ||
          req.params?.productionID ||
          req.params?.grnID ||
          req.params?.sessionId,
        method: req.method,
        path: req.originalUrl,
        ipAddress: req.ip,
        metadata: { statusCode: res.statusCode },
      }).catch(() => {});
    }
  });
  next();
};
