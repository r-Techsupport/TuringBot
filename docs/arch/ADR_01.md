# ADR 01: Creating Dependencies To Gracefully Track Resource Status

2023-06-04

Arc

# I want things to fail gracefully when a resource is not available

With TS, when a resource (say, a database or config option) is not available, the code runs blindly anyway, hoping that the error will be caught by an error handler. When the error is caught,
it's often a large, unhelpful error. From the "user" side, where people are calling commands, the errors make even less sense, and are frustrating. Extension (module) developers access resources
with the assumption that they do exist, and are functioning correctly. If they do decide to verify a resource is available, then the methods that they use to do so are inconsistent.

# Designing a structure to enable module developers to define resources and indicate usage of resources

I want to address this issue by having some sort of structure that can define and indicate resource usage. I'm designing the structure as I write this ADR, and so
this should be a fairly pure, from the ground up representation of my plans.

I want:

-   A way for developers to define and reference dependencies easily, without ever needing to touch the core.
-   Useful error messages that are returned when a command is used, that explain what was not available, and (maybe) why

A module could have a list of dependencies passed to the constructor, and before execution, the executor can verify that all dependencies are ready to be accessed.
If any of the dependencies are not accessible, an error message could returned that's actually helpful, maybe something along the lines of "This command has unmet dependencies: \[deps\]"

A class (maybe `Dependency`) could be defined under `modules.ts`, with info tied to a dependency like a name, and work needed to be done to check the status of a dependency included,
possibly work needed to initialize a dependency(maybe that returns the actual resource).

Using domain machines to model various states of data: https://carlton.upperdine.dev/post/typescript-domain-modelling

Because execution of a command will only be carried out when all of the dependencies are initialized, modules can be written with the assumption that every dependency is available, and ready for use.

As it turns out, with a little bit of abuse, the `Promise` syntax makes a lot of sense for a use case like this. There's ways to indicate pending, failed, and succeeded, and tie the value to it.

This class could be shaped like this, although this is certainly not polished:

```typescript
class Dependency {
    // a pretty name that's displayed on errors, eg "MongoDB" or "<X> API key"
    name: string;

    // while this could just be any, specifying that it's either *nothing*, an error, or the value seems to make more logical sense
    private value: null | Error | NonNullable<any>

    // developer defined function that tries to fetch the resource, where T is the type of the resource
    //
    private attemptResolution: <T>(): Promise<T | Error> => {};



    // there of course needs to be a way for the developer to actually define methodology for getting the dependency
    // thorough docstrings explaining this def plz
    set async function resolve(attemptResolution: <T>(): Promise<T | Error> => {}) {
        todo("set attemptResolution")
    };

    // because we want all modules to be resolved by the time
    get async function resolve<T>(): Awaited<Promise<T>> {
        todo("first check and see if the dep has already been resolved");
        todo("if the value is an error, than we've already tried to resolve the dep and failed");
        todo("if the value is null, than we haven't tried to resolve the dependency, do so now");
        todo("if the value is not null and not an error, than it's the result of the dependency, return that");
    }
}
```

I want the "framework" for dependencies to make it simple for devs to define methods to access resources and to check the availability of a resource,
and I think this should be a nice way to do that.

Ideally, developers would be forced to specify that they're using a dependency before they can access it, but I don't know of a good way to do that. I'll probably just put "encouraging"
documentation everywhere.

# Consequences

I want this to be required in the constructor, so that people are forced to acknowledge it when creating modules, even if they can still access the resources without specifying it.
This means that all module implementations will need to be re-written. As much as I'd like to slow down on changing the module structure, the best time to optimize it is when it's early.

There should be little performance overhead, because dependencies are resolved when needed, and only once.
