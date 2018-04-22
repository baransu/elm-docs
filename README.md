# elm-docs

> 📖 Markdown documentation generator for elm-make compatible projects

Example generated docs for [wende/elchemy](https://github.com/wende/elchemy): https://gist.github.com/Baransu/26ce8e7c987f68f078a8e415a2601d3c

## Usage

Install globally with you package manager of choice:
```sh
yarn global add elm-docs
# or
npm install -g elm-docs
```

Then go into root of your `elm-make` project and use
```sh
elm-docs
```
By default output will be placed in `DOCS.md` file in your current directory. To specify custom output file you can use `--output, -o` flag and define your file of choice like that:
```sh
elm-docs --output DOCUMENTATION.md 
```
It will output documentation into `DOCUMENTATION.md` file in you current directory.

## Licence

MIT © Tomasz Cichocinski
