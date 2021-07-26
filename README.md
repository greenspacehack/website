## Greenspace Hack website

This is the source code for the Greenspace Hack website at [greenspacehack.com](https://www.greenspacehack.com/).

All site materials are in `src/`. The site is republished from there at regular intervals.

Page parsing and creation is done by `site_builder.rb`, as described in the comments to that file. Pages can be created in Markdown (.md), Eruby (.erb) or plain HTML (.html). Eruby directives can be included in Markdown files. Pages are surrounded by partials as set out in the `_template.json` file for each directory.

The source dataset is mirrored from the endpoint created for the Greenspace Hack app.
