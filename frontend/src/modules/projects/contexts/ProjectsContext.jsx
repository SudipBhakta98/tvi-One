import { createResourceContext } from "../../../core/contexts/createResourceContext.jsx";
import { ENDPOINTS } from "../../../services/endpoints";

const { Provider, useResource } = createResourceContext({ displayName: "Projects", baseEndpoint: ENDPOINTS.PROJECTS.BASE });

export const ProjectsProvider = Provider;
export const useProjects = useResource;
