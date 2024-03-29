# Drupal.org / Slack App

[![Remix on
Glitch](https://cdn.glitch.com/2703baf2-b643-4da7-ab91-7ee2a2d00b5b%2Fremix-button.svg)](https://glitch.com/edit/#!/remix/drupalorg-slack)

The `drupalorg-slack` Slack app uses Drupal.org's API to retrieve several
data points that are relevant to an organization's [Drupal
Marketplace](http://drupal.org/marketplace) rank and report it into your Slack
workspace. The data points include issue credit count, number of projects
supported, and case studies submitted, as well as the marketplace rank itself.
It also keeps track of the "high scores" for each of these values.

The functionality is composed of two pieces, the slash command, and an external
trigger:

* The slash command is triggered from within Slack by any user with permission
  and will result in an ephemeral message sent back to Slack with the response.
  Only the requesting user can see this response.
* The external trigger allows for a request from outside of Slack to trigger the
  app. This is useful for scheduling the app to notify a channel regularly.

![drupalorg-slack app screenshot](https://user-images.githubusercontent.com/20355/205161865-662e0a19-b284-42ea-836a-55d381524dde.png)

## Getting Started

1. [Remix on Glitch](https://glitch.com/edit/#!/remix/drupalorg-slack) (easiest
   for a quick start since Glitch will host your app and provide a URL for
   Slack to talk directly to; [more info on Glitch](https://glitch.com/about)).
   Alternatively, and more traditionally, you may clone this repo and get the app
   running somewhere that it will be accessible on the web.
1. Copy [`.env.sample`](.env.sample) to `.env`.
1. Create a new app in the [Slack "Your Apps"
   dashboard](https://api.slack.com/apps).
1. In your newly created Slack app configuration, Create a slash command via the
   "Slash Commands" tab in the sidebar and set the request URL to your app:
   `https://your-app-name-here.glitch.me/slack/events`
1. Configure the required environment variables in `.env`:
    1. `SLACK_SIGNING_SECRET`: Navigate to the "Basic Information" tab and use
       the "Signing Secret".
    1. `SLACK_BOT_TOKEN`: Navigate to the "Install App" tab and use the "Bot
       User OAuth Access Token" value.
    1. `DRUPAL_ORG_NODE_ID`: Your organization's node ID from Drupal.org.
1. Configure the optional environment variables in `.env`. These values are
   utilized when the app is triggered from an external source such as a cron or
   Jenkins job as opposed to a "slash command" from within Slack.
    1. `DEFAULT_CHANNEL_ID` / `SANDBOX_CHANNEL_ID` (optional): Populate these
       values with the Slack channel ID's where you want the app to post
       notifications. The easiest way to get these values is to load your Slack
       workspace in a web browser (as opposed to the Slack app) and grab the
       channel IDs from the address bar.
    1. `ORG_TOKEN`: A secure value used to validate a request.
1. Customize default values:
    1. `DEBUG_MODE`: Setting this value to `true` results in the
       `SANDBOX_CHANNEL_ID` being used instead of the `DEFAULT_CHANNEL_ID`.
    1. `VERBOSE_MODE`: Set to `true` to enable verbose console logging.

## Example Trigger Request

To trigger the app from outside of Slack:

1. Ensure `DEFAULT_CHANNEL_ID`, `SANDBOX_CHANNEL_ID`, and `ORG_TOKEN` are
   configured as described above.
1. Make a POST request with your token in the following format:

```bash
curl --fail -X POST \
  'https://your-app-name-here.glitch.me/triggers?token=YOUR_ORG_TOKEN_HERE'
```
