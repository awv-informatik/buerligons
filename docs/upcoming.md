---
sidebar_position: 3
---

# Upcoming Features

## CCScript

CCScript is a safe subset of the ClassCAD language, designed to enable API calls directly within our engine. The Script API executes CCScript just like a standard API call, ensuring seamless integration.

CCScript is ideal for automation, whether used as a standalone tool via an HTTP request or integrated into a CAD application like Buerligons. Within such applications, it can be used to implement custom features in a part’s history or invoked in a broader context.

A CCScript can be considered the coded representation of a model. In addition to storing the native model, its code equivalent could be maintained on GitHub, allowing software development workflows, including CI/CD pipelines, to be leveraged. While we haven’t yet implemented model export, this feature is planned for the near future.

These scripts can be dynamically loaded on demand from a specified URL.

When executing a script in an active session, you can pass parameters from the session to it. Similarly, when running a script in a new session, you can establish a context by first loading a model into it.

Think of these scripts as specialized functionality within a CAD environment—useful for specific cases but impractical to embed directly into the system due to complexity. For example, consider a product configurator that needs to handle numerous variations of each part within an assembly.


##  Python
A **Python API** for broader accessibility. 



  
