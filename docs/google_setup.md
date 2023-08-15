
This guide will show you how to set up the Google API and Custom search engine (CSE) for usage with the google module. All of this is free if you don't exceed 100 queries a day for the CSE API.

# Setting up the Google Cloud project
In order to use any of the google APIs, you will need to set a Cloud project up.

1) Navigate to the [Google Cloud console homepage](https://console.cloud.google.com)
2) Click on `Select a project` <br>
![image](https://github.com/zleyyij/TuringBot/assets/100243410/13b75269-9663-42b0-bb3f-428ef6898d07)

3) Click on `New project` <br>
![image](https://github.com/zleyyij/TuringBot/assets/100243410/6209939d-568c-41b6-a24d-2dd86fd04008)

4) Configure it as you wish, hit create <br>
![image](https://github.com/zleyyij/TuringBot/assets/100243410/7dea6054-c289-43f5-addc-aad5c53f3791)

The Project is set up now, a notification will pop up saying it is creating. Wait for it to finish creating the project and hit `Select project` <br>
![image](https://github.com/zleyyij/TuringBot/assets/100243410/6c99d0e3-af1e-45dd-99cf-9447b0ac10f7)

If the notification doesn't appear for whatever reason you can also click on `Select project` and click on your new project. <br>
![image](https://github.com/zleyyij/TuringBot/assets/100243410/1f0b4802-b85b-45d6-9b83-894e884dc615)

# Enabling the relevant APIs
Now we will need to enable the two relevant APIs - CSE v1 and Youtube data v3.

1) From the project homepage, click on `APIs and services` <br>
![image](https://github.com/zleyyij/TuringBot/assets/100243410/f09c6fcc-2a35-45e4-9f08-22767ba12f6f)

2) Hit search and look up `Custom search`, go to the `Custom search API` menu <br>
![image](https://github.com/zleyyij/TuringBot/assets/100243410/9d5aa347-b669-4312-a7be-cc13392fa960)

3) Once here, you can hit `Enable`
4) You can repeat these steps for the Data API <br>
![image](https://github.com/zleyyij/TuringBot/assets/100243410/78c903b9-0220-4887-a3c9-d639ff3be2a1)

# Creating an API key
Both APIs used by Turingbot are now enabled, we can move on to creating an API key.

1) On the left side of your screen, click on `Credentials` <br>
![image](https://github.com/zleyyij/TuringBot/assets/100243410/923e2a0d-5ebf-44d6-b087-09673d30e6ee)

2) Click `Create credentials` and select `API Key` from the popup menu <br>
![image](https://github.com/zleyyij/TuringBot/assets/100243410/63d1c05d-d7c0-4605-b0a6-d3983f6dfb64)

3) A screen with your API key will now show up, please **copy it into a safe place** as **you won't be able to see it again**.

4) As a safety precaution, you can hit click on the new API key entry and restrict it to only use the `Custom search engine` and `Youtube Data` APIs. <br>

![image](https://github.com/zleyyij/TuringBot/assets/100243410/51be4d3b-3ccf-4b38-87fc-ba0176478485)

# Setting a Custom search engine up
Now that we have the relevant APIs enabled and have a valid API key prepared, we can create a custom search engine to use.

1) Go to the [Googles Programmable search engine website](https://programmablesearchengine.google.com/about/)
2) Click `Get started`, then click on `Add`
3) For use with TuringBot select the `Search the entire web` option, enable `Image search`. `SafeSearch` is optional but preferred. Once done, hit `Create` <br>
![image](https://github.com/zleyyij/TuringBot/assets/100243410/ae429375-28c3-4019-ad6e-4f5ae0e4a1fb)

4) Once you hit `Create` you will get a short Javascript snippet with its implementation, you can copy the ID from the first line after `cx=` or you can hit `Customize` and copy the `Search engine ID` from there. <br>
![image](https://github.com/zleyyij/TuringBot/assets/100243410/2f378666-52ab-46ab-bad3-4a169b640538)
![image](https://github.com/zleyyij/TuringBot/assets/100243410/b94f4325-05fd-4004-9b7c-d8aa573531c3)


You now have all the necessary credentials to use Google with TuringBot.

[//]: # (All credentials and Ids used in this guide have been invalidated.)

   
