This document explains the scope and broad design choices. 
# Feature Scope
## Targets
Because this is being built as a replacement to TechSupportBot, there is some critical functionality that must be met at minimum, as well as capability I'd like to build that has proven to be lacking in TechSupportBot.

Minimum targets include:
- Message logging. This impelentation should log messages in a mirrored Logging category. This implementation should handle message events (creation, editing, deletion), and automatically create logging threads that mirror the logged channel. The implementation should handle the massive scale that comes with logging a high volume of messages, and support manual logging, like commands used.
- Factoids. This implementation should include the management of factoids (creation, editing, documenting, and deleting). It should not be bound to a single prefix.
- User moderation. This implementation should include per-channel message logging, as well as an easy framework to moderate users (kick, ban, time out)
- Support for unit tests
- Simple deployment. Deployment should require minimal configuration. a Makefile should be used to simplify processes.

Non-critical high priority targets:
- Google CSE (image search, text search, youtube, pagination)

Non-critical targets:
- Complete extension parity with TechSupportBot

## Non-targets
- Multi-server support. This proves to increase configuration, and I feel that the tradeoff of computational power for running multiple instances is worth it.

# Design Choices
## Language and Platform Choice
### Final Decision
I ultimately settled on Kubernetes running Node Typescript + discord.js/Karasuta.

Reasoning:
Discord.js is the most widely used Discord library, and has proven to be the library of choice for many large bots. The addition of Karasuta would allow for multithreading of modules. Each module would exist on its own shard Each shard would be given a kernel thread, and would automatically be remade by the [ShardingManager](https://discord.js.org/#/docs/discord.js/main/class/Shard) as the threads exit or fail. This would greatly improve resiliancy, as well as performance.

TypeScript was chosen to allow for greater resiliancy over standard JavaScript. It will add some development complexity as the code interacts with loosely-typed or non-typed environments. However, I feel that the improved error prevention and forced correctness are overall benificial. 

While there are many pros to this decision, there are some drawbacks to be made aware of.
- Resiliancy. Javascript and Typescript do not have as robust handling of errors as some alternatives, like Rust. We should try to mitigate this by making use of the `Promise` pattern where possible.
- Performance. Javascript and Typescript are less performant than other possible language choices, however I feel that the performance is still sufficient, and the positives that come with the Discord.js ecosystem outweigh the performance disadvantage. 

Kubernetes was chosen because it offers features like Service Discovery and Probing. It would allow for the creation of resiliancy clustering. This will introduce initial development complexity, but careful documentation and configuration will mitigate this. The ability to run resiliancy nodes on different devices would avoid reliability being dependant on a single server, as this has presented issues in the past. 

### Alternatives
#### Go
Go was initially looked at because it excels at network operations and learning curve, which would lower the barrier for contribution. It was discarded as a choice because the Discord API wrappers were all fairly immature, with little to no documentation and a small community.

#### Python
Python was initially one of the strong contenders, striking a nice performance middle ground between low and high level, with a fairly large community. I feel that the library (discord.py) is not as polished, and it is not as stable, primarily referencing the time [the library ended development](https://dev.to/abhijithganesh/end-of-discord-py-58pc) for a while because there was only one maintainer.

#### Rust
Rust was another strong contender, with the purpose of Rust aligning well with our needs. Rust excels at building scaleable, safe, predictable, maintainable, and efficient programs. There were many language traits that appealed to me, however there were a few drawbacks. [Referring to a presentation by one of the founders](http://venge.net/graydon/talks/intro-talk.pdf), Rust is *not* built for the web. Moreso, Serenity.rs (the primary language Discord library) appeared clunky and poorly documented, with an inactive community. 

# Resources
https://github.com/shitcorp/Discord-Bots-At-Scale
https://github.com/kamranahmedse/design-patterns-for-humans#creational-design-patterns
