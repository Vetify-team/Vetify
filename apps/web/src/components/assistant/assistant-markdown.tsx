import { Fragment } from "react";
import { parseMarkdown, type Inline } from "@/lib/assistant";

function Line({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, i) =>
        part.bold ? (
          <strong key={i} className="font-semibold">
            {part.text}
          </strong>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * An answer of the assistant: paragraphs, lists and bold, read by
 * `parseMarkdown` and rendered as React elements. The text is never
 * interpreted as HTML.
 */
export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      {parseMarkdown(text).map((block, i) => {
        if (block.kind === "paragraph")
          return (
            <p key={i}>
              {block.lines.map((line, n) => (
                <Fragment key={n}>
                  {n > 0 && <br />}
                  <Line parts={line} />
                </Fragment>
              ))}
            </p>
          );
        const List = block.ordered ? "ol" : "ul";
        return (
          <List
            key={i}
            start={block.ordered && block.start !== 1 ? block.start : undefined}
            className={`flex flex-col gap-1 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}
          >
            {block.items.map((item, n) => (
              <li key={n}>
                <Line parts={item} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
