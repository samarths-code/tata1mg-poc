"""Muthoot Video PD services: the logic behind muthoot/routes.

  sheet            Google Sheet access (LOS, Results, Events tabs)
  los              customer records from the LOS tab
  links            signed PD links: issue, read, validate
  mailer           emails a PD link over SMTP
  videosdk         VideoSDK tokens/rooms, Zero Runtime agent dispatch, Face Match
  sessions         link -> room + token, consents -> agent, selfie pause
  face             MediaPipe face count
  reference_photo  the customer's reference face photo (local or Drive)
  selfie           M2-6 selfie check
  results          M2-9 result row -> results_sheet (Results tab)
  journey_events   journey events -> jsonl + Events tab
"""
