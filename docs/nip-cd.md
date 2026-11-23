# Slash commands in the post editor

- Select a bot with `@` at the start of the editor, then type `/` to see its commands. Jumble queries the bot's advertised write relays for command definitions and caches the results for one day. After one day, its cached commands remain selectable while the menu refreshes in the background.
- Type `/` at the start to browse commands already cached on this device, without querying relays. Each suggestion names its executor, even when two bots advertise the same command.
- Suggestions filter by the outgoing note or reply kind (1 or 1111) and the author when known. Commands with tag or relay requirements may appear before those details are known. Selecting one inserts `/command@nostr:npub…` at the beginning of the draft without sending the post. The editor highlights the command separately from its arguments.

![Cached commands from two executors in Jumble's post editor](images/nip-cd-command-menu.png)

![The command menu showing Loading during bot discovery](images/nip-cd-command-loading.png)

## Command definitions

Opening a kind 31992 event shows a read-only command card with its trigger, description, arguments, and scopes. Opening or quoting a definition does not run the command.

![A kind 31992 command definition displayed as a card](images/nip-cd-command-definition.png)
