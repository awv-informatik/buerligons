---
sidebar_position: 2
---

#  Advanced Topics
TEXT
##  Parts and Assemblies

We provide part and assembly modelling. If you want to create multiple parts in a single session, you must use the assembly mode and create parts within a part container using API call partTemplate. Similarly, you can create asssemblies, again as templates, with assemblyTemplate.  

To bring existing parts into a assembly session, you use loadProduct, which fills the part and assembly container and makes the templates ready for instantiation. i.e. placing instances in the assembly.

The usage of setCurrentInstance supports you when updating existing templates and allows you to control recalculation of templates.  Recalculation of parts rresults in applying the operation sequence, while recalculation of assemblies triggers a 3d constratint solving process on possibly different assmebly hierarchies.




## Embedding SolidAPI and CurveAPI within PartAPi as a custom feature   

Shapes created with CurveAPI can be used within SolidAPI or PartAPI. Solids from SolidAPI within PArtAPi.

Shapes and solids reside in a Operation which must be created and act as a container, were the results of the executed code resides.
A script can be loaded from the plugin like a StepFile and execution of the script leads to curves and solids. These are not parametric like a step file.



## Scripts within Part or Assembly Building



A script can be used to create reports like BOM 




##  Some important notes about CAD in the cloud,  

ClassCAD, like most other CAD systems, is a "in-memory" CAD. This means that a process or engine is started, and the model is loaded or created into memory for processing. The model itself can be stored in a database or in files elsewhere.  


In cloud environments, where processes may crash or connections can be lost, it is crucial to store the state of an ongoing CAD interactive design session. Think of it as a high-performance auto-save feature that minimizes the risk of data loss.
To understand the difference between stateful and stateless applications, we first examine the three different ways our engine can be used and how communication channels play a role.
<ol>
<li>**HTTP-Based CAD Service (Stateless)**</li>
The simplest usage, where state management is not a concern, is through a REST-based CAD service. For example, you can load a parametric model, modify its parameters to create a variant, and then export it. In ClassCAD, this is done by sending a CCScript to an API endpoint. The script is executed, and ideally, the system returns an "OK" status.

<li>**Interactive CAD Design Sessions (Stateful)**</li>
For interactive CAD design sessions, state management is essential. These sessions are typically implemented using WebSockets, which allow bidirectional communication. The browser remains connected to the CAD process through an instance or a load balancer. If any part of this connection fails, it must be possible to recover the session seamlessly. Today we provide a node.js based instance manager. In the future we will replace it by a more capable loadbalancer written in C++ and thus avoiding the need of node.js in many usecases situations. 

<li>**WASM-Based CAD Engine (Client-Side Execution)**</li>
In this scenario, no server is required for state management. The WASM package is loaded once from our Cloudflare storage and then resides in your local browser cache. This executable runs directly in the browser, leveraging local CPU, GPU, and other resources. This is a single click installed parametric CAD system; no setup, just instant access.
</ol>

##  State Management Approaches
For cloud-based CAD, state management can be centralized or decentralized, each with its own advantages and disadvantages.

<ol>
<li>**Decentralized State Management (Currently Supported)**</li>
In this approach, the state is stored on the machine where the process is running. This ensures high performance since data remains local. However, it has limitations in optimizing resources when handling many users. While users can be swapped within the same machine, moving a user to another machine after a long session pause is more challenging.

Load balancers address this with a "sticky session" flag. If a user is swapped out due to inactivity, the system ensures they reconnect to the same machine when they resume. Note that on a single machine with N cores, N processes can run in parallel. 

<li>**Centralized State Management**</li>
This approach involves moving states to different machines and using in-memory databases like Redis to enhance performance. Unlike decentralized management, it allows for more flexible resource allocation across multiple users and machines.
 
</ol>

**NOTE**: It is also worth to mention, that the REST based approach can be made statefull by storing states and provide stateidentification with the parameters of each REST call.





