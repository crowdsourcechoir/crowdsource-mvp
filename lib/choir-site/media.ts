const CDN = "https://images.squarespace-cdn.com/content/v1/6952cc2ac1ff9a475583f6c5";

/** Photos and product art from the Crowdsource Choir site. */
export function choirImage(path: string, width = 1600): string {
  const clean = path.replace(/^\/+/, "");
  return `${CDN}/${clean}?format=${width}w`;
}

export const choirMedia = {
  logo: choirImage("48018d49-b4de-4ead-9865-ba0038962c94/Crowdsource+Choir+Rainbow+Logo+Bright.png", 800),
  hero: choirImage("1767053876726-V12FHWZ6FIF7683IL93T/unsplash-image-DMYmEtYRf3Y.jpg", 2500),
  heroFigure: choirImage("14eb5a14-3b35-43dd-baaa-b9604b4be5f2/Remove+background+project.png", 1500),
  crowd1: choirImage("33a78b41-99be-43b8-a621-288b0b694730/Crowdsource+Choir+1.png", 1400),
  crowd18: choirImage("e2f72a60-a318-46be-8499-b475b7a2f429/Crowdsource+Choir+18.png", 1400),
  crowd12: choirImage("d480e4b5-d2cb-4ae7-b5e9-95106094ebb7/Crowdsource+Choir+12.png", 1400),
  crowd17: choirImage("c17c2f5a-c460-4f08-9839-fc137d0b2599/Crowdsource+Choir+17.png", 1400),
  crowd15: choirImage("ccbbe616-81f2-4ca6-8650-523a6735ffba/Crowdsource+Choir+15.png", 1600),
  crowd10: choirImage("41714b59-6e23-49b5-9154-1e4fe99070bb/Crowdsource+Choir+10.png", 1400),
  crowd21: choirImage("c899a6c8-1ee9-4240-9695-344c01e64a82/Crowdsource+Choir+21.png", 1400),
  artform: choirImage("1767113286690-XZT2Z980KUWCRMHWH1H7/unsplash-image-4OpUENf2Kyw.jpg", 1600),
  show: choirImage("d97a2efb-510f-4dcf-81df-6fb7ef09d738/Screen+Shot+2025-12-29+at+5.03.20+PM.png", 1400),
  night: choirImage("8e9e15e4-3af6-4fec-b3c1-3dd43606d584/PXL_20241222_015134800.NIGHT.RAW-01.COVER%7E2.jpeg", 1600),
  aboutMark: choirImage("150e128e-072d-47bc-b11e-a6ca7f37e09b/Remove+background+project+%281%29.png", 900),
  joel: choirImage("08cfae25-4325-46b3-819e-0d55aa13df6c/Screen+Shot+2026-01-01+at+6.10.29+PM+%281%29.png", 1200),
  ken: choirImage("1e864470-b801-44e1-8d9d-e68ee9ceebd0/Ken+Nsimbi.jpeg", 1200),
  kenJoel: choirImage("39e2bab6-7635-47e0-a3ab-4dd979233409/Ken+and+Joel.png", 1400),
  bookHero: choirImage("72a107f3-2ef2-4dbd-aa68-b1448abfb480/IMG_0727+%281%29.jpeg", 1800),
  anthem: choirImage("c95b5f07-e51f-4b5a-85b1-0633b1d5addc/anthem.jpg", 1400),
  quote: choirImage("7ca335fb-95ee-40ce-b653-d0277ee9aae4/IMG_3824+2+%282%29.png", 1200),
  ready: choirImage("5055813c-f7f5-40ea-ae8f-6f8fa6429ec5/IMG_0696.jpeg", 1600),
  modeRaise: choirImage("5bc3bc0d-bb61-4c39-8a10-1d4d8270f4b9/ChatGPT+Image+Jan+4%2C+2026%2C+09_24_03+PM+%281%29.png", 1000),
  modeKeynote: choirImage("9e293f10-7cff-4d27-b3df-508150c13a73/ChatGPT+Image+Jan+4%2C+2026%2C+09_24_08+PM+%281%29.png", 1000),
  modeCreative: choirImage("4838566c-bfdc-4367-b66a-c4ea5e3b2ce4/ChatGPT+Image+Jan+4%2C+2026%2C+09_24_43+PM+%281%29.png", 1000),
  modeThreshold: choirImage("d0301284-0a31-4945-8018-82c83430147e/ChatGPT+Image+Jan+4%2C+2026%2C+09_25_06+PM+%281%29.png", 1000),
  starbucks: choirImage("5aa8e4e0-548b-472c-93aa-d92c85b01e52/Starbucks+3x2.png", 800),
  rei: choirImage("3567f0c2-0382-4b29-bfd0-678bf99eeefd/REI+3x2.png", 800),
  microsoft: choirImage("f7779dd8-3850-482a-a369-37c591bbccbb/Microsoft+3x2.png", 800),
  amazon: choirImage("cf33323e-2540-48ed-8a5f-71597771c3fb/Amazon+3x2.png", 800),
  seattleu: choirImage("ea1a52ed-f91c-487f-a99d-d9551e9dbfa0/SeattleU+3x2.png", 800),
  seattleRefined: choirImage("a1277c52-c35c-46de-802b-0f5f216dc80e/seattle+refined.png", 600),
  npr: choirImage("c089da9c-3187-401f-b4c6-fb7083e06bbf/npr.png", 600),
  emerald: choirImage("38edae2f-07fa-4ade-8152-47a356ffe16f/download.png", 600),
};
