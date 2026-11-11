# Notebook Lock (reMarkable 2, XOVI)

A UI mod that lets you lock notebooks behind a password.

- A locked notebook shows a **blank cover with a padlock** and the caption "Locked".
  This applies in My Files (grid and list), search results and the Recent/Favorites drawer.
- Opening a locked notebook brings up a **password screen** with the on-screen keyboard.
  The notebook opens only after the correct password.
- Password: `carmelite4` (set in `notebookLock.qmd`, look for `nlPassword`).

> This is a **UI lock only**. Nothing is encrypted. The files on the tablet, the
> desktop and mobile apps and the cloud still show everything. The lock is stored on
> this tablet only.

Built and checked against **xochitl 3.28.0.172**, the current reMarkable 2 release.
The file paths and object ids were taken from that firmware's own QML. Other versions
may move things around.

## Requirements

- [XOVI](https://github.com/asivery/rm-xovi-extensions) with **qt-resource-rebuilder**
  (installed by default with XOVI).
- SSH access. The root password is in *Settings → Help → Copyrights and licenses*.

You don't need to rebuild the hashtab: this mod uses plain (unhashed) names.

## Install

From your computer, with the tablet connected over USB:

```bash
./install.sh            # or: ./install.sh <tablet-ip> over Wi-Fi
```

To install by hand, copy `notebookLock.qmd` to
`/home/root/xovi/exthome/qt-resource-rebuilder/` on the tablet and run
`/home/root/xovi/start`.

## Use

| To… | Do this |
|---|---|
| Lock | Long-press a notebook (or several) → **…** (More) → **Lock** |
| Open a locked notebook | Tap it → enter the password → **Open** |
| Unlock permanently | Select it → **…** → **Unlock** → enter the password |

The Lock/Unlock entry is hidden when a folder is part of the selection.

## Remove

```bash
./install.sh --remove
```

Your lock list stays in `/home/root/.config/remarkable/notebook-lock.conf`. Delete that
file to clear every lock.

Restarting the tablet always returns it to the stock UI: XOVI doesn't persist across
reboots unless you set up a starter such as xovi-tripletap. While XOVI isn't running,
notebooks aren't locked.

## If something doesn't work

Check the log right after starting XOVI:

```bash
ssh root@10.11.99.1 'journalctl -u xochitl --since "-2min" --no-pager | grep -iE "qmldiff|Error while"'
```

If one file fails to patch, qmldiff skips that file's patch. The errors name the file
(for example `ContentGridItem.qml`), which tells you which part to look at.
