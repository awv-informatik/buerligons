---
sidebar_position: 2
---

#  Sketching Tool

Our interactive constraint based sketcher allow us to create 2d geometry using lines, arcs and circles.  We hope that the usage is intuitive and will focus in the dicument only on those aspects, which are special in our system or different to others.

When starting, you must select on of the main workplanes to sketch on. In later modelling phases, you could also select a face of a brep, or workplanes, you defined by yourself. For faces, the system autmatically creates a workplane and adds it before you sketch. Thus somehow separating workplane referencing from sketching.

This allows you in later phases also to change the workülae of a sketch in the Position Tab of the sketcherplugin. In this Tab you can change the WP , its direction and it even allows you to overwrite a default origin and default orientation.

##  Geometry

You can create lines/ polylines by selcting line icon and then clicking in the canvas.  Using "ESC" is very important to leave different all editing modes.  The current active mode is visualized as a highlighted icon.

## Constraints 
We support geometrical and dimensional constraints.

You can switch the constraint display on and off using the eye icon in the constraint Tab. If on the contarints are always shown in the cavas, if off they are dynamically positioned and shown.
Incidentscontarints on points etc must be explicitly turned on with the incident icon, beside the eye icon.



##  Fillets

Enter fillet mode and fillet two lines by hovering over a incident point of the two lines and then clicking on it.  Within the fillet mode you can alway undo the fillet by clicking on the newly created  point, which is incident to the filleted lines.
Leave modus by pressing "ESC".

Dimensional contraints on the original lines, will get a new refernce to the point and thus keeping original length distances, whewn filleting.


##  Split/Trim

## Use geoemtry / reference


## Details Pane


## Region

We support the concept of named regions, which are simple containers for geoemetry, that could be used for extrusions or revolve operation.  These regions, can either be created beforehand in the region tag, where you give it a name, or when you create a extrusion.  After firat creation, the region can be accessed by the "R" icon in the canvas. Named regions are very usfull in particular in the combination with Buerli programming. 

## Pattern 










