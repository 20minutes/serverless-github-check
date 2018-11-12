# Serverless Github Check

[![serverless](http://public.serverless.com/badges/v3.svg)](https://serverless.com/)
[![Build Status](https://travis-ci.org/20minutes/serverless-github-check.svg?branch=master)](https://travis-ci.org/20minutes/serverless-github-check)

Apply some simple checks on each PR.

## Use Case

It validates GitHub Pull Requests against some specifications:
- `body` should be at least 8 characters long
- `title` should be at least 8 characters long

## Prerequisites

- Node.js 8.10
- Serverless CLI v1.27.0 or later (`npm install -g serverless`)
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

## Info

This little project is part of the [#NoServerNovember challenge](https://serverless.com/blog/no-server-november-challenge/).
