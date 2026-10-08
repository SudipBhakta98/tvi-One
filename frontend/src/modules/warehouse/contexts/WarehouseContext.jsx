import { createResourceContext } from "../../../core/contexts/createResourceContext.jsx";
import { ENDPOINTS } from "../../../services/endpoints";

const { Provider, useResource } = createResourceContext({ displayName: "Warehouse", baseEndpoint: ENDPOINTS.WAREHOUSE.BASE });

export const WarehouseProvider = Provider;
export const useWarehouse = useResource;
