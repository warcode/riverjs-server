##### Signed by https://keybase.io/warcode
```
-----BEGIN PGP SIGNATURE-----
Version: GnuPG v1.4.12 (GNU/Linux)

iQEcBAABAgAGBQJTj4JQAAoJEKcjCgeYmTza39sH/jrazuOtvX3SXlogDdmXGu4X
vh5eBxxAGCMvH66oVlwUrmmj43OYrtNu3oWvJD2Dr8hM1lARUPcd3EPf6IzngDnm
el3hAYsmShWWejwS268aD26BADYQrmqWkVlAgJo4WE+ArMYZ/IggEP8WLj31SqFZ
RwMOvq4Zz+PHbJWmgycDxCGRcRA2R6nWJoA9fq0W3iIG1odOC16QxbPosmaIrdHj
MHR8YlFhfVKP/qc2XtyWtSY9Bs04BWs0s78yi55Bgi3TCwAbhM8TGDGRR1x+OnsP
uFX4LlGbx14dQHFeZUb4kM52WHDv37mbZDhH7NWsW5m04DYHQkNlmwNnMzXpfFk=
=cHA0
-----END PGP SIGNATURE-----

```

<!-- END SIGNATURES -->

### Begin signed statement 

#### Expect

```
size   exec  file                 contents                                                        
             ./                                                                                   
483            .gitattributes     dcc4e04a9952ff446b9d78c624d80379b0f20f5817a89b9b2b1ab8b55b82fd52
2643           .gitignore         1d5189269aa96147468b2ea7a88e45383c0fbdb5b621ca0cb6495a0bfcefe89b
392            README.md          efcae6f5ebc98542e3bb4f237f9e1b1b6c987a873561dc15cd956eb9ea04845e
236            config.default.js  4f422a091c0463230088048768a1b761dd1e723aadf47b50237a6269d3c5b0eb
210            package.json       7d8b35166d4bc116a1fdeae69cb30a2a5fa8ec887f93eaf7cd08a1416ae29284
11417          river-server.js    1571ac3e0be2acad3536edbdba029abef298302a4ba9d89a7bfd1ad57e3e2fc3
```

#### Ignore

```
/SIGNED.md
```

#### Presets

```
git      # ignore .git and anything as described by .gitignore files
dropbox  # ignore .dropbox-cache and other Dropbox-related files    
kb       # ignore anything as described by .kbignore files          
```

<!-- summarize version = 0.0.8 -->

### End signed statement

<hr>

#### Notes

With keybase you can sign any directory's contents, whether it's a git repo,
source code distribution, or a personal documents folder. It aims to replace the drudgery of:

  1. comparing a zipped file to a detached statement
  2. downloading a public key
  3. confirming it is in fact the author's by reviewing public statements they've made, using it

All in one simple command:

```bash
keybase dir verify
```

There are lots of options, including assertions for automating your checks.

For more info, check out https://keybase.io/docs/command_line/code_signing