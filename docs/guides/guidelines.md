This document explains guidelines that developers should follow when contributing to the TuringBot codebase, as well as offering advice for building clean, maintainable code.

# Comments

Please refer to the resources list at the bottom of this section for more commenting guidelines.

Code should be thoroughly commented and documented, especially the `core`. 

The quality of comments is more important than the quantity. Comments that are added purely for the sake of more comments should be avoided. If a comment doesn't directly clarify the surrounding context, it should be improved or removed. 

- Good comments should explain *why* a piece of code exists, and enable developers to make connections to other pieces of code.
- If you find a piece of code hard to comment, then that can indicate that the code is not very high quality, or easy to understand. 
- Comments require maintenance, and good comments will require minimal upkeep as the code develops and changes.
- Comments should be written for someone reading the code for the first time. As developers write comments for code, they have the full context of the surrounding code in their mind. They have a deep understanding of every part of the code, which can lead to bad comments. If a developer writes comments assuming the next person to read them fully understands everything that the developer did when they wrote the comment, then the comments will not be as helpful.
- Please follow the practices posted [here](https://stackoverflow.blog/2021/12/23/best-practices-for-writing-code-comments/) for more documentation.

## Standard Documentation
- File docstrings should contain a high level summary of the code contained in the file. Module files should have a link to all exported modules.

```typescript
/**
 * Command that sends an embed containing uptime, meant to indicate that the bot is running.
 * Modules:
 *   {@link ping}
 */
```

- Any region that you feel needs improvement, or was left unfinished can be marked with a `// TODO: comment`.


Comments should adhere to the best practices linked below

## Documentation

- https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html

## Best practices

- https://stackoverflow.blog/2021/12/23/best-practices-for-writing-code-comments/
- https://mitcommlab.mit.edu/broad/commkit/coding-and-comment-style/

# Code Style
All submitted code should conform to the Google Typescript/Javascript style guide. If a piece of code does not, include documentation explaining why. 

Please see the [Google Typescript Style Guide](https://google.github.io/styleguide/tsguide.html), referring to the [Google Javascript Style Guide](https://google.github.io/styleguide/jsguide.html), where the Typescript style guide is not sufficient.

## Key Points
The below does not include everything, and is simply a collection of important parts of the style guide.
- Variables are defined using `const`, unless they need to be reassigned, in which case they must be declared, using `let`. `var` is not acceptable.
- Tabs take the form of *two spaces*.
- Newlines are *LF*, not *CRLF*.
- Variables, functions, parameters, functions, methods, and properties are `camelCase`. This includes local constants, and variables that are immutable by chance.
- Global constants that should *never change* are `SCREAMING_SNAKE_CASE`. Examples of a variable that may be named using `SCREAMING_SNAKE_CASE` include:
  - Magic Numbers (EX: `FOO_BAR = 0x12345`)
  -  Asset URLs (EX: `EMBED_ICON = 'https://foo.bar/icon.png'`)
  - File Paths (EX: `CONFIG_PATH = '../../config.jsonc'`) 
- Classes, enums, types, type parameters, interfaces, are `PascalCase`.


# Variable Names

Proper variable naming greatly contributes to the readability and maintainability of code. Names should not be abbreviated in the core, and abbreviation should be kept to a minimum during module development, especially regarding function calls.
Some general rules to follow:

- Names should denote single values vs plural values. If a name is denotes the type of the variable, it's generally not a good variable name. Where a good name for an array of dog names might be `dogs`, a bad name could be `dog` or `dogsArray`.
- Don't use different words that have the similar meanings. Having variables named `parsedData`, `processedData`, and `formattedData` can lead to confusion, and is an indication of a badly named variable
- Functions should be a verb or verb phrase (generally a verb followed by a noun). An example of a good function name might be `missDuck`, or `formatDenyEmbed`

## Variable Naming Resources

https://betterprogramming.pub/clean-code-naming-b90740cbae12<br>
https://www.rithmschool.com/blog/good-ideas-for-better-variable-names

# Commit messages

All commit messages should conform to the [Conventional Commit Standard](https://www.conventionalcommits.org/en/v1.0.0/).

# Broad Code Quality

Code quality is extremely difficult to define as an objective metric. Rather than attempt to create minimum standards or define vague, amorphous ideas that are hard to apply in practice, I'll lay out a few general ideas that can be kept in mind when writing code, that should helpfully improve the end product.

- Focus on the connections between different parts of code, rather than the actual content of the code. Writing code that enables developers to create simple mental maps, and easily understand connections between different parts code will make further development easier, and result in higher quality code.
- Prioritize the human over the computer. As developers become deeply engrossed in a problem, they start thinking on a level more closely to how computer interprets code. This can enable developers to solve complex problems, but it can also lead to unintuitive, unclear code that takes time to understand. If you can write your code and comments in a way that make the thought process easier to understand. Comments should prioritize explaining the impact of the code, rather than what the code is doing (code that makes use of advanced concepts may benefit from a functional explanation). 
- Good code is written with the idea that someone else is going to need to read your code.

# Code review
// TODO: https://google.github.io/eng-practices/