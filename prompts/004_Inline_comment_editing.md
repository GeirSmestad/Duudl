# Inline comment editing

I'd like an improvement to the "comment" feature. In the "show Duudl" view, users can scroll down and add optional comments to the dates where they might be available to meet.

Currently, users can only add comments by scrolling to a specific date. I have a vision for an improvement to this feature, that I want to implement for *non-mobile users only*. The ideal implementation would be as follows:

When the user hovers over a cell in the table view that *belongs to the logged-in user*, show a temporary pencil icon in the very top-right corner of the cell. Its length and height can each be maybe 25% of the cell width and height. When this icon is *clicked*, a text cursor appears in that particular cell and the user can enter a comment for that cell with the keyboard. For the purposes of this discussion only, we call this "edit mode".  Clicking anywhere else or pressing enter or esc leaves edit mode.

While typing, text is continuously commited, exactly as when we're using the comment fields that can be opened in the "detaljerte valg" part of the page. This feature should ideally interact nicely with the existing comment feature, meaning that the comment field in the "detaljerte valg" part of the page silently appears when entering edit mode, and that its content is synchronized with whatever the user enters into the cell itself.

Make a plan for this where you find out reasonable tradeoffs for how this can be implemented in an ideomatic and maintainable way.