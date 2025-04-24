---
sidebar_position: 1
---
# Introduction to Buerligons CAD

Welcome to **Buerligons**, our end-user, history-based, parametric CAD system. Developed using the Buerli Client Framework and powered by our **ClasssCAD** engine, Buerligons provides a robust environment for designing precise, parametric CAD models—directly in the browser.

Buerligons **runs entirely in the browser**, thanks to our CAD engine compiled into WebAssembly (WASM). This allows users to launch the system with a single click—no installation required. Once downloaded, the application is cached by the browser, enabling fast performance and offline availability.

For more advanced scenarios, Buerligons can also connect to a server-based instance using WebSockets. This setup supports collaborative workflows or extended backend processing, though it requires slightly more configuration and infrastructure.

---

## 🛠️ Part Modeling

Buerligons empowers users to model **parts and assemblies** with an intuitive and feature-rich toolset:

- **2D parametric sketches**: Easily create and fully constrain 2D profiles.
- **Solid generation**: Generate solids using **extrude**, **revolve**, and **twist** operations. Upcoming features will include swept solids (pipe and path sweeps).
- **Sheet modeling**: Create thin-walled features by extruding open profiles or omitting end caps.
- **Primitives**: Quickly insert basic shapes such as **boxes**, **cylinders**, and **cones**. All primitives are placed using **parametric coordinate systems**.
- **Work geometry**: Define supporting geometry like planes, axes, points, and coordinate systems to guide modeling.
- **Boolean operations**: Modify geometry through **union**, **subtraction**, and **intersection** operations.
- **Edge treatments**: Refine geometry using **fillets** and **chamfers** on BRep edges.

> 📷 *Insert Screenshot: Sketching and Extrusion Example*

### Feature History & Rollback

Buerligons includes a **rollback bar**, allowing users to move through the model’s creation history. Editing a feature moves the rollback to the appropriate point, enabling contextual and historical model edits.

- Supports non-linear, parametric editing
- Encourages exploration, learning, and rapid iteration

> 📷 *Insert Screenshot: Feature History with Rollback*

### Referencing

Referencing in Buerligons is robust and flexible, allowing users to base new features on both **work geometry** and **BRep elements**, ensuring parametric stability throughout the modeling process.

---

## 🧩 Assembly Modeling

The **Product Management Plugin** streamlines the creation and management of assemblies within the canvas:

- Interactively instantiate parts and sub-assemblies
- Relate components using **3D assembly constraints**, including:
  - `Fastened Origin`
  - `Fastened`
  - `Revolute`
  - `Cylindrical`
  - `Slide`

> 📷 *Insert Screenshot: Assembly with Constraints*

### Pattern Constraints

Accelerate design work with automated instancing:

- **Linear Patterns**
- **Circular Patterns**

These features reduce repetitive modeling tasks and enhance productivity.

---

## 🔄 Import & Export

Buerligons supports **import and export of STEP models**. Assemblies within STEP files are preserved during import. When importing into **part mode**, the assembly is flattened into a single part context.

---

## 🚧 Upcoming Features

Buerligons is in continuous development. Every release brings new capabilities and refinements—stay tuned for updates and feature announcements!

---

## ⚠️ Scope and Focus

Buerligons is **not** intended to compete with high-end CAD systems. Its focus is on:

- Simple, browser-based parametric design
- Efficient recalculation of parts and assemblies with new parameters
- Lightweight deployment and use

> ⚠️ Freeform modeling and direct editing are currently **not supported**.

---

## 🎮 Interacting with the 3D Canvas

- **Context menus**: Access object-specific tools with a right-click.
- **Selection tools**:
  - Drag left-to-right to select fully enclosed elements
  - Drag right-to-left to select intersecting elements

> 📷 *Insert Screenshot: Canvas Interaction with Selection Box*

---
