# Serverless GitHub Check

[![serverless](http://public.serverless.com/badges/v3.svg)](https://serverless.com/)
[![Build Status](https://github.com/20minutes/serverless-github-check/actions/workflows/tests.yml/badge.svg)](https://github.com/20minutes/serverless-github-check/actions/workflows/tests.yml)

Apply some simple checks on each PR.

![Example](https://user-images.githubusercontent.com/62333/51041495-5d9a3b80-15ba-11e9-9ead-815448ad0fee.png)

## Use Cases

We have 3 functions available:

- **specification**: It validates GitHub Pull Requests against some specifications:
    - `body` should be at least 8 characters long
    - `title` should be at least 8 characters long
- **label**: It check if there is a blocking label in the GitHub Pull Request
    - if one blocking label (default: `Work In Progress`, `Waiting For Change`, `Waiting For Travis`) is found, PR is blocked
    - if no labels are defined in the PR, PR is blocked
    - if no blocking labels are defined, PR is validated
- **fixup**: It check if there is some `fixup!` commits in the PR history
    - if at least one fixup commit are found, PR is blocked
    - if no fixup commits are found, PR is validated

## Prerequisites

- Node.js 12
- Serverless CLI v1.81.0 or later (`npm install -g serverless`)
- An AWS account
- Defined [provider credentials](https://serverless.com/framework/docs/providers/aws/guide/credentials/)

## Setup

### Deploy the code

- Get a [new personal access token](https://github.com/settings/tokens/new) on GitHub
- Set it in [AWS Parameter Store](https://eu-west-1.console.aws.amazon.com/systems-manager/parameters/create?region=eu-west-1) as a `SecureString` with name `GITHUB_TOKEN`
- Deploy the service using: `serverless deploy`

By default

- it'll use the AWS profile `default`, but you can use your own using (be sure it's defined in your `~/.aws/credentials`): `serverless deploy --aws-profile myprofile`
- it'll be deployed to the AWS region `eu-west-1` but you can change it using: `serverless deploy --region us-east-1`

### Setup GitHub webhook

Configure the webhook in [the GitHub repository settings](https://developer.github.com/webhooks/creating/#setting-up-a-webhook).

- In the Payload URL, enter the URL you received after deploying. It would be something like `https://<your_url>.amazonaws.com/dev/webhook`.
- Choose the "application/json" in Content type.
- In the types of events to trigger the webhook, select "Let me select individual events", then select at least `Pull Requests`.

### Some options

You can update some options from the `serverless.yml` file:

- `NAMESPACE`: change the namespace used in the PR check (displayed at the bottom of each PR)
- `CHECK_BODY_LENGTH`: change the minimun length of the body of the PR
- `CHECK_TITLE_LENGTH`: change the minimun length of the title of the PR
- `BLOCK_LABELS`: define which label will block a PR (coma separated strings)

## Info

This little project is part of the [#NoServerNovember challenge](https://serverless.com/blog/no-server-november-challenge/).
