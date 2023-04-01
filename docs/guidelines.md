This document explains guidelines that developers should follow, as well as offering device for building clean, maintainable code.

# Comments

Please refer to the resources list at the bottom of this section for more commenting guidelines.

Code should be thouroughly commented and documented, especially the `core`. Docstrings should be used liberally, and should be in the following locations.

-   At the top of files. This docstring should contain a high level summary of the code contained in the file. The below example is for a `ping` module

```typescript
/*
 * Command that sends an embed containing uptime, meant to indicate that the bot is running.
 */
```

-   Variable definitions. This docstring should at minimum contain a type.
-   Class definitions. This docstring should contain a description of the class
-   Function definitions. This docstring should explain what the function does, as well as the types of all arguments and return values.

There are more usecases where docstrings might be used, but they should be used in all the above cases unless you are confident it is not needed. Should you need to add comments later, mark the relevant section with a `TODO` comment.

Comments should adhere to the best practices linked below

## Documentation

-   https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html

## Best practices

-   https://stackoverflow.blog/2021/12/23/best-practices-for-writing-code-comments/
-   https://mitcommlab.mit.edu/broad/commkit/coding-and-comment-style/

# Whitespace

## Spaces

-   There should be one space after a comma, none before. A newline may also be used if you are formatting an object or array with JSON style formatting, with a newline after every declaration.
-   There should be one space on either side of an assignment operator or boolean comparison. Correct formatting of this will be structured similar to `val = thing`, or `val >= thing`.
-   Statements (`if`, `for`, `while`, `function` are to be formatted with a space between the identifier, the arguments, and the context. Correct formatting may look like:

```javascript
if (val == thing) {
    doTheThing();
}
```

## Tabs

-   Tabs are to be composed of 4 spaces.

## Newlines

-   Newlines are to be LF.
-   Preferred syntax for files includes two or more newlines after library inclusions, one newline after function declarations, and wherever needed to seperate code into logical sections.

# Variable Names

Proper variable naming greatly contributes to the readability and maintainability of code. Names should not be abbreviated in the core, and abbreviation should be kept to a minimum during module development, especially regarding function calls.
Some general rules to follow:

-   Names should denote single values vs plural values. If a name is denoting type, it's generally not a good variable name. Where a good name for an array of dog names might be `dogs`, a bad name could be `dog` or `dogsArray`.
-   Names should generally be pronounceable, if you can't pronounce a variable name, it may not be a good description of the purpose of the variable.
-   Don't use different words for the same meaning. Having variables named `parsedData`, `processedDta`, and `parsedData` can lead to confusion, and is an indication of badly named variables.
-   Functions should be a verb or verb phrase (generally a verb followed by a noun).

## Resources

https://betterprogramming.pub/clean-code-naming-b90740cbae12
https://www.rithmschool.com/blog/good-ideas-for-better-variable-names

# Commit messages

Commit messages should follow the format `(sectionOfCodeChanged): description of what section of code was changed, and why. A good example of this might be `(core): fixed bug with exampleFunctionCall failed when fooing`. A bad example might be `(core): small fixes and improvements`.
