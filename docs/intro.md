---
sidebar_position: 1
---

# Introduction

Let's discover the ClassCAD API and how to use ClassCAD in more depth.


**ClassCAD** is our powerful CAD engine, written in C++, designed to execute API calls in multiple ways. To get started, you need to [register here] and download your AppKey [here]. This key enables you to run the engine across various platforms.

It's important to note that you have complete freedom to host and deploy ClassCAD as you see fit. AWV Informatik AG does not offer a SaaS solution.

## How to Use   
The easiest way to get started is by **cloning our Buerli starter repository** and following the setup instructions.Currently, you can interact with **ClassCAD** using:  
-*TypeScript APIs*, accessible from the browser via a Node-based instance manager.  
-*WebAssembly (WASM)*, allowing direct execution in the browser.  

See the Upcoming section for further usages.

## Use Cases for ClassCAD & Its API  

Our **ClassCAD engine** and its **APIs** empower developers across various domains, including:  

 **1. Custom CAD Applications**  
 Build tailored solutions for specific design needs.  
 **2. Automating Repetitive Design Tasks**  
 Increase efficiency by scripting repetitive processes.  
 **3. Configurators & Mass Customization**  
 Enable parametric design for on-demand product variations.\
 **4. AI-Driven & Generative Design**  
 Leverage automation for innovative design solutions.  
 **5. Smart Documentation & Compliance**  
 Ensure accurate, rule-based documentation and compliance tracking.  


### What you'll need to know about our APIs

Our **CAD APIs** support both part creation and assembly construction. We leveraged these APIs to develop Buerligons dev.buerligons.io , a parametric CAD system for end users. This showcases how you can use the APIs to build your own custom CAD applications.

Starting from version v1, all APIs are versioned and follow clear, standardized design principles:

- JSON Parameters – All APIs accept a single JSON key-value parameter, making them more resilient to breaking changes.
- Result & Error Handling – Every API call returns a JSON object containing both a result and an error section.
The JSDoc documentation provides all the necessary details for using the APIs. We use this documentation to automatically generate a TypeScript API, with Python support coming soon.


-**Part API**\
This API enables you to create parts using a sequence of operations or features, similar to how parts are built interactively in Buerligons. Solid geometry is generated when the sequence is executed. The models created through code can also be opened and further modified within Buerligons.

-**Assembly API**\
The Assembly API enables constraint-based assembly construction. Models consist of parts and assemblies, which are stored in containers. These containers act as templates, allowing instances to be positioned in 3d space when creating new assemblies.
Positioning is handled using 3D constraints, such as fastened, revolute, and slider constraints, which are defined on mates. Our 3D constraint solver ensures correct positioning of all components.

-**Solid API**\
For applications where only the final geometry matters, the Part API may not be the best approach. That’s why we offer a destructive Solid API, allowing you to programmatically generate solid geometry using extrusions, revolutions, and Boolean operations—without unnecessary steps. Here, you first create a part and then generate geometry within a solid container object.

-**Sketcher API**\
This API enables the creation of parametric sketches with 2D constraints. Programming sketches can be complex because you’re not just defining geometry (lines and arcs) but also constraints. Once a constraint is added, the embedded solver applies it, potentially modifying the geometry accordingly. Sketches can be created on workplanes, including those defined on planar faces of BRep geometry. The interactive sketcher embedded in Buerligons follows the same principles.

-**Curve API**\
Beyond simple geometric elements like lines and arcs, the Curve API supports Bezier curves and polynomial-based interpolation. Additionally, it offers compatibility with AutoCAD’s polyline approach, using points and bulges. Curves can be grouped into shapes, which can then be used for extrusions or other operations.


-**Drawing API**\
The Drawing API allows the creation of 2D drawings from 3D models. It internally applies hidden-line removal and projects 3D curves onto a plane. Users can define different views (e.g., TOP, ISO) and position them accordingly.
For exporting, we use the Open Design Library to generate DXF and SVG formats.

## Key Differentiators Compared to Other CAD API Providers

-**Self-Hosted Engine**: You have full control over hosting the engine, making it accessible to your end users via web technologies. 

-**WASM-Based Engine**: Our WebAssembly (WASM) engine is a compact ~40MB package containing your entire CAD system. Your end users can run the application directly in their browser with just a single download—eliminating hosting costs on your side while supporting unlimited users. No install, just a single click.

-Customizable with **Buerli Client Framework**: Easily tailor your CAD applications with the Buerli Client framework, ensuring flexibility and adaptability to your needs.

Regardless of your company’s size, we provide an affordable flat-rate pricing model for businesses large and small. Since you host everything yourself, we offer a flat-rate pricing model—no per-API-call charges![Link to AWV Pricing Page]


## ClassCAD and the solid kernel
Think of ClassCAD as an object system that manages the results of calls to the CAD kernel. ClassCAD is built on SMLib, a NURBS-based kernel developed by Solid Modeling Solutions, a company that was acquired by Nvidia several years ago. We have been working with this kernel for over 20 years. The kernel supports non-manifold BREP modeling and provides tesselation functionality for visualisation in a client.
We currently use only a fraction of the overall functionality and will provide other APIs
for surface modelling or polygonal modelling in the future. 


A bit of history: ClassCAD was initially implemented using ObjectARX as an extension for AutoCAD. Later, we transitioned to the ACIS kernel to develop a standalone CAD. However, due to business model challenges with Spatial, we eventually switched to SMLib. Before making this decision, we explored alternative solutions, including a prototype implementation with Open Cascade in 2003.

## ClassCAD and constraint solving

As a parametric CAD system we support 2d and 3d constraint solving.  Our SketchAPI and our interactive sketcher in Buerligons supports the normally used constraints and dimensions. Additional functionality for filleting and triming/splitting of sketchgeometrie is available.

In 3d we use constraints, like revolute, slider or fastened to position parts in 3d. Constraints are expressed on mates, which are coordinates systems on the parts. Move under constraints is supported in 2d and 3d.

Our solvers are licences from Bricsys, a part of Hexagon AB, a global provider of the BricsCAD brand and  design software components.