# DevOps Alignment: Edge Cluster Container Orchestration

**David Kross**: We are aligning on container management for the Project Helium edge nodes. Since these nodes are physically distributed, standard heavy Kubernetes is out of the question. We are using Rancher K3s.

**Marcus Vance**: David, what happens if an edge node loses its cell connection? Does it stop balancing the local substation power grid?

**David Kross**: No. The local grid balancing loop runs as a standalone C++ micro-service that talks directly to the micro-controller over Modbus. It operates independently of the K3s control plane. If connection is lost, it continues autonomous operations and buffers logs locally. Once the cellular link recovers, the container syncs the metrics database.

**Dr. Elena Rostova**: That is excellent. I am packaging the local predictive model in a lightweight WASM container. This will allow it to run on the node with less than 256MB of RAM.
- **Decision**: Standardizing on Rancher K3s with local autonomous offline loop execution.
- **Action Item**: David to publish the edge deployment Docker templates by May 22nd.
