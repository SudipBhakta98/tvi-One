import { createResourceContext } from "../../../core/contexts/createResourceContext.jsx";
import { ENDPOINTS } from "../../../services/endpoints";

const { Provider, useResource } = createResourceContext({ displayName: "Purchase", baseEndpoint: ENDPOINTS.PURCHASE.BASE });

export const PurchaseProvider = Provider;
export const usePurchase = useResource;
