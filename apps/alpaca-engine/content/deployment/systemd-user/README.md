# Alpaca engine systemd service

Install `alpaca-engine@.service` in the user unit directory. Each instance uses
a configuration file at `~/.config/alpaca-engine/INSTANCE.env` with
`ALPACA_STATE_ROOT`, `ALPACA_CUSTODY_ROOT`, and `ALPACA_MANDATE_REFERENCE`.
The file selects an existing private mandate and contains no broker secrets.
Install the engine executable at `~/.local/bin/alpaca-engine` and configure a
timer for each instance according to that mandate's schedule.
