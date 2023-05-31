# ADR 00: Using Architecture Decision Records
2023-05-31

Arc

## Documenting things is hard
I feel that plans for various changes are not very well documented. By implementing ADRs, I think changes will be easier to understand, and the implementation of changes will
remain more organized and cohesive. Writing ADRs can serve as a way to plan out an implementations, and fully flush out ideas before any change to the codebase is made. These
records can serve as a drawing board for new ideas, documenting the thought process behind them.

I encountered a very interesting read [here](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions) that described a method of documenting decisions
and changes, and have decided to try them out with TuringBot.

## Using ADRs to document decisions and changes
We will keep a collection of records for decisions that affect structure and other changes that affect the project as a whole.


These records will be kept as `.md` files in this directory, each record will be named `ADR_XX.md`, where `XX` is the number of record made.

The top section of each record should generally comply with the below format:
```md
# ADR XX: Descriptive Title
YYYY-MM-DD (RFC 8601)

Author(s)
```

Each record should be short, and concise. They should roughly conform to the [Alexandrian Pattern](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/templates/decision-record-template-for-alexandrian-pattern/index.md, 
so a description of the context around the decision, the motive behind the decision, and the planned implementation details of the decision.
If you see fit, you can also include any possible consequences, explaining the effect this decision will have on the rest of the project, as well
as possible mitigation for any issues that might come up.

If a decision is changed, or superseded, then the original document may be edited (and noted as such) to explain the revision, or a new document made,
and the old document edited to reference the newer document.

If relevant, the status may be appended to the bottom of the document. This should describe whether a change is planned, under discussion, completed, superseded, or
any suitably descriptive word to describe the state of a change. The developers in charge of implementing the change may also be listed in this section.

Please refer to [the document linked above](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions) for a more detailed description.