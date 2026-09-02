Next.js server less for backed

Electron for frontend (mono repo)

Neon for database (from the start)

- Better Auth since next.js and neon

React Flow: https://reactflow.dev/

This will be a graph based spacial organizer for companies (or individuals, students..) 

Anything listed is just examples, it's ultimately open, there may be baked in ontologies or ability to create them, but the way you set it up is up to you.

Basically an electron app that can run in browser as well (minus tools like open . or cursor . for local files) where each node generally represents:

- Area of business (Marketing, Sales, Product, Support, Legal etc.)
    - Production lines (i.e LinkedIn post generation in Marketing)
    - Storefronts (I.e landing page in sales)
        - Files / Memories / Context (I.e where LinkedIn posts live or actual LinkedIn posts

An idea, perhaps in the long term, not to do now is you can define what things like space or color mean, and programtically configure boards, such that in example you have an ontology for LinkedIn posts, and a board that includes all of them, and their distance from central node is when posted and their edge colors represents success based on metrics on the ontology, and these auto pull in from dir or database or something

- AGAIN, not now

To start, each node has default fields (I don't want this infinite customizability like figma)

- Title
- Descriptions
- OnClick — i.e run open cli command or open ide command / link, etc.
- 

There's boards that should be hierarchical and specifically, a board should always have a parent node (to encourage spacial organization), i.e the Marketing board is a child of the Chair board, which has the high level business stuff on it

- Parent node
- Parent board

## High Level Goals

- [ ]  Boards are not fundamentally hierarchical, nodes can link to boards though, (and points on the board) which makes it seem hierarchical
- [ ]  
- [ ]  
- [ ]