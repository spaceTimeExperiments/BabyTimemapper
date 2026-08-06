# WELCOME TO BABYTIMEMAPPER
BabyTimemapper is a program that is directly based off of [Timemapper](https://github.com/okfn/timemapper) by [okfn](https://github.com/okfn) (Open Knowledge Foundation) but updated to be stylized and run smoother with local based data input. 

You can run this program through GitHub cloning or you can download the zipped directory if gitclone isnt available to you.

For those looking to use the GitHub based method, you can follow these steps to do so!

# BabyTimeMapper Crash Course!

## Installing Node.js
First thing that everyone should do is install Node.js to their system:
### For MAC: 
```
# Download and install Homebrew if not already installed 
curl -o- https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh | bash
# Download and install Node.js:
brew install node@24
# Verify the Node.js version:
node -v # Should print "v24.18.0" or whatever the latest version is.
# Verify npm version:
npm -v # Should print "11.16.0" or whatever the latest version is.
```

### For Windows:
```
# Download and install Chocolatey:
powershell -c "irm https://community.chocolatey.org/install.ps1|iex"
# Download and install Node.js:
choco install nodejs --version="26.5.0"
# Verify the Node.js version:
node -v # Should print "v26.5.0".
# Verify npm version:
npm -v # Should print "11.17.0".
```
### You can also go to https://nodejs.org/en/download/current and download a prebuilt Node.js

Make sure to gitclone the repo to your local directory before the next step!

## Installing the node modules for BabyTimeMapper
Once you have Node.js installed you'll need to install the node files needed to run the program, the command is:
```
npm install
```
Once this is complete you should be able to use ```events.xml``` to edit the events shown on BabyTimemapper!

## Editing events.xml

To use BabyTimemapper you'll need to edit the ```events.xml``` file directly. There are two templates in the notes folder, ```eventsTemplate.xml``` and ```eventsFilled.xml```, which can be referenced when editing ```events.xml``` in the public folder. 
There are simple rules and directions in ```eventsTemplate.xml``` which are:
* The month, day, and era sections are completely optional, if these areas of info are not available to you then dont worry about filling them out, you can just remove them
* Events do not need to be in chronological order they will be sorted with a JS function
* For event tracks please limit to 3 distinct tracks, ie. early events, recent events, future events. Please fill in the 'name=""' with whatever you want and correspond the correct track numder (1, 2, or 3) with the name, (ex. type="1" name="early events" and type="3" name="future events
* Each track can have multiple events
These can also be found at the top of ```eventsTemplate.xml``` as mentioned before. 