#!/usr/bin/env python3
"""Post tweet to X API v2 using OAuth 1.0a"""

import os
import requests
from requests_oauthlib import OAuth1Session

# Get credentials from environment
API_KEY = os.getenv('X_API_KEY')
API_SECRET = os.getenv('X_API_SECRET')
ACCESS_TOKEN = os.getenv('X_ACCESS_TOKEN')
ACCESS_TOKEN_SECRET = os.getenv('X_ACCESS_TOKEN_SECRET')

if not all([API_KEY, API_SECRET, ACCESS_TOKEN, ACCESS_TOKEN_SECRET]):
    print("ERROR: X API credentials not set in environment")
    print("Required: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET")
    exit(1)

# Article title (from GO app article)
article_title = "未経験からタクシー運転手で年収800万円は本当？GOアプリ活用の稼ぎ方"

# Prepare tweet text
tweet_text = f"""{article_title}

詳しくはプロフのリンクから↓
https://tenstrage.pages.dev

#タクシー転職 #東京タクシー"""

# X API v2 endpoint
url = "https://api.twitter.com/2/tweets"

# Create OAuth 1.0a session
auth = OAuth1Session(
    API_KEY,
    client_secret=API_SECRET,
    resource_owner_key=ACCESS_TOKEN,
    resource_owner_secret=ACCESS_TOKEN_SECRET
)

# Post tweet
try:
    response = auth.post(
        url,
        json={"text": tweet_text},
        headers={"Content-Type": "application/json"}
    )

    if response.status_code == 201:
        tweet_data = response.json()
        print(f"✓ Tweet posted successfully!")
        print(f"Tweet ID: {tweet_data['data']['id']}")
        print(f"URL: https://twitter.com/tenstrage/status/{tweet_data['data']['id']}")
    else:
        print(f"✗ Failed to post tweet: {response.status_code}")
        print(response.json())
        exit(1)

except Exception as e:
    print(f"✗ Error posting tweet: {e}")
    exit(1)
