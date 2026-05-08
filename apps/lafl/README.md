# LAFL Worker - Language-Aware File Loader

This Cloudflare Worker indexes a working directory using tree-sitter ASTs for 22+ languages and returns only files relevant to a given operation description.

## Supported Languages

The following 22 languages are supported via tree-sitter grammars:

1. TypeScript (`@tree-sitter-grammars/typescript`)
2. JavaScript (`@tree-sitter-grammars/javascript`)
3. Python (`@tree-sitter-grammars/python`)
4. Rust (`@tree-sitter-grammars/rust`)
5. C (`@tree-sitter-grammars/c`)
6. C++ (`@tree-sitter-grammars/cpp`)
7. Go (`@tree-sitter-grammars/go`)
8. Ruby (`@tree-sitter-grammars/ruby`)
9. Java (`@tree-sitter-grammars/java`)
10. HTML (`@tree-sitter-grammars/html`)
11. CSS (`@tree-sitter-grammars/css`)
12. Bash (`@tree-sitter-grammars/bash`)
13. PHP (`@tree-sitter-grammars/php`)
14. Swift (`@tree-sitter-grammars/swift`)
15. Kotlin (`@tree-sitter-grammars/kotlin`)
16. Scala (`@tree-sitter-grammars/scala`)
17. Lua (`@tree-sitter-grammars/lua`)
18. Haskell (`@tree-sitter-grammars/haskell`)
19. Elixir (`@tree-sitter-grammars/elixir`)
20. Clojure (`@tree-sitter-grammars/clojure`)
21. C# (planned)
22. SQL (planned)

> Note: C# and SQL grammars are planned but not yet implemented in this version.

## Development

```bash
# Start local development
yarn dev

# Run tests
yarn test

# Build for production
yarn build
```