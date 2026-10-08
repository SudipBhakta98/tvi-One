import { createResourceContext } from "../../../core/contexts/createResourceContext.jsx";
import { ENDPOINTS } from "../../../services/endpoints";

const { Provider, useResource } = createResourceContext({ displayName: "Dispatch", baseEndpoint: ENDPOINTS.DISPATCH.BASE });

export const DispatchProvider = Provider;
export const useDispatch = useResource;
