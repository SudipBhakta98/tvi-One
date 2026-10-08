import { createResourceContext } from "../../../core/contexts/createResourceContext.jsx";
import { ENDPOINTS } from "../../../services/endpoints";

const { Provider, useResource } = createResourceContext({ displayName: "Rfq", baseEndpoint: ENDPOINTS.RFQ.BASE });

export const RfqProvider = Provider;
export const useRfq = useResource;
