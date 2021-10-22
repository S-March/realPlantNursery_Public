var landscapeFlexContainerDirections = ["reverse", "column-reverse", "row-reverse", "column"];
var portraitFlexContainerDirections = ["column", "row", "column-reverse", "row-reverse"];

var websock;
var websockIsOpen;

var currentContentView = 0;

var currentProjectSelected = '';
var oldProjectSelected = '';

var vh = window.innerHeight * 0.01;
var vw = window.innerWidth * 0.01;

var numberOfProjects = projectNames.length;
var startingProject = numberOfProjects - 1;
var projectToShow = startingProject;

var fadeOutInProgress = false;

var scrollLockedOut = false;

var touchYStart = 0;
var touchYEnd = 0;

var readMeasuredData = true;

var panelIsOpen = false;
var settingsNeedToBeSaved = false;

var moistureData = '';
var lightData = ''

var plantName = '';
var waterThreshold = '';
var sunExposure = '';
var batteryThreshold = '';
var silentMode = '';

var chartWasCreated = false;
var myChart;

window.addEventListener("wheel", handleScroll);
window.addEventListener("touchstart", handleTouchStart);
window.addEventListener("touchend", handleTouchEnd);

function reloadPage()
{
    location.reload();
}

function handleTouchStart(event)
{
    touchYStart = event.touches[0].clientY;
}

function handleTouchEnd(event)
{
    touchYEnd = event.changedTouches[0].clientY;
    if (Math.abs(touchYEnd - touchYStart) >= 50)
    {
        var touchDelta = -1 * Math.sign(touchYEnd - touchYStart);
        lockOutScrollListener(1500, touchDelta);
    }
}

function handleScroll(event)
{
    window.removeEventListener("wheel", handleScroll);
    var scrollDelta = Math.sign(event.deltaY);
    lockOutScrollListener(1000, scrollDelta);
}

function lockOutScrollListener(LOCKOUT_TIME, SCROLL_DIRECTION)
{
    switch (SCROLL_DIRECTION)
    {
        case 1:
            startingProject = startingProject ? (startingProject - 1) : (projectNames.length - 1)
            if (projectNames[startingProject] == 'projectList')
            {
                startingProject--;
            }
            projectToShow = startingProject;
            mainLoadPage();
            break;
        case -1:
            startingProject = (startingProject < (numberOfProjects - 1)) ? (startingProject + 1) : (0)
            if (projectNames[startingProject] == 'projectList')
            {
                startingProject++;
            }
            projectToShow = startingProject;
            mainLoadPage();
            break;
        default:
            mainLoadPage();
    }
    var scrollLockOutTimer = setTimeout(reenableScrollListener, LOCKOUT_TIME);

    function reenableScrollListener()
    {
        window.addEventListener("wheel", handleScroll);
    }
}

function mainLoadPage()
{
    vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', '${vh}px');
    currentContentView = 0;
    if (readMeasuredData)
    {
        document.getElementById("backupInstructions").style.display = "none";
        readMoistureDataFile();
        readLightDataFile();
        readSettingsFile();
        loadSettingsPage();
        websocketStart();
        readMeasuredData = false;
    }
    settingsNeedToBeSaved = false;
    closePanels();
    clearChart();
    panelIsOpen = false;
    fadeOutThenIn('projectSprialContainer', mainBuildPage);
}

function mainBuildPage()
{
    /*******************************/
    /***Build HTML skeleton first***/
    /*******************************/
    var mainPageStructure = '';
    var numberOfProjectsToShow = 4;
    //Note: Subtract 1 from this loop to ensure a new div isn't created at the end
    for (var projectLinkElement = 0; projectLinkElement < (numberOfProjectsToShow - 1); projectLinkElement++)
    {
        mainPageStructure += '<div class="goldenRatioItem"></div><div class="goldenRatioContainer">'
    }
    mainPageStructure += '<div class="goldenRatioItem"></div>'
    for (var projectLinkElement = 0; projectLinkElement < (numberOfProjectsToShow); projectLinkElement++)
    {
        mainPageStructure += '</div>'
    }
    document.getElementById('projectSprialContainer').innerHTML = mainPageStructure;

    /****************************************************************************************/
    /***Assign projects to individual elements (includes links, backgrounds and adds ID's)***/
    /****************************************************************************************/
    var allLinkReferences = document.querySelectorAll('.goldenRatioItem');
    for (var numberOfLinkReferences = 0; numberOfLinkReferences < allLinkReferences.length; numberOfLinkReferences++)
    {
        allLinkReferences[numberOfLinkReferences].id = projectNames[projectToShow];
        allLinkReferences[numberOfLinkReferences].classList.add("goldenRatioLargeItemRow");
        if (projectWithMainGif.includes(projectNames[projectToShow]))
        {
            //CHECK LAST LINE OF DATA
            allLinkReferences[numberOfLinkReferences].style.backgroundImage = 'url(projects/' + projectNames[projectToShow] + '/mediaAssets/imageAssets/main.gif)';
        }
        else
        {
            allLinkReferences[numberOfLinkReferences].style.backgroundImage = 'url(projects/' + projectNames[projectToShow] + '/mediaAssets/imageAssets/main.jpg)';
        }
        allLinkReferences[numberOfLinkReferences].setAttribute('onclick', 'togglePanel(this.id)');
        //        allLinkReferences[numberOfLinkReferences].setAttribute('href', 'projects/' + projectNames[projectToShow]);
        projectToShow = projectToShow ? (projectToShow - 1) : (projectNames.length - 1)
    }


    /*************************************************************************/
    /***Adjust size and position of boxes depending on potrait or landscape***/
    /*************************************************************************/
    var currentOrientation;
    var windowRatio = window.innerWidth / window.innerHeight;
    var allTopBodyContainers = document.getElementsByClassName('topBodyContainer');
    if ((window.innerWidth > window.innerHeight))
    {
        /*************************************/
        /***Device is wider than it is tall***/
        /*************************************/
        currentOrientation = 'LANDSCAPE';
        document.getElementById('projectSprialContainer').style.outline = "0.5vw solid rgba(44, 44, 44, 1)";
        document.getElementById('projectSprialContainer').style.outline = "0.5vw solid rgba(44, 44, 44, 1)";
        document.getElementById('projectSprialContainer').style.outlineOffset = "-0.5vw";
        for (var numberOfContainers = 0; numberOfContainers < allTopBodyContainers.length; numberOfContainers++)
        {
            var viewIDName = 'view' + numberOfContainers;
            allTopBodyContainers[numberOfContainers].setAttribute("id", viewIDName);
            var allItemsInContainer = document.getElementById(viewIDName).querySelectorAll('.goldenRatioContainer');
            allItemsInContainer[0].style.width = "100vw";
            allItemsInContainer[0].style.height = 100 * vh + 'px';
            var flexDirectionReverse;
            if (allTopBodyContainers[numberOfContainers].classList.contains('reverseFlex'))
            {
                flexDirectionReverse = 2;
            }
            else
            {
                flexDirectionReverse = 0;
            }
            allItemsInContainer[0].style.flexDirection = landscapeFlexContainerDirections[(0 + flexDirectionReverse)];
            for (var subContainers = 1; subContainers < allItemsInContainer.length; subContainers++)
            {
                allItemsInContainer[subContainers].style.flexDirection = landscapeFlexContainerDirections[((subContainers + flexDirectionReverse) % 4)];
                if (subContainers % 2)
                {
                    allItemsInContainer[subContainers].style.width = "38.2%";
                    allItemsInContainer[subContainers].style.height = "100%";
                }
                else
                {
                    allItemsInContainer[subContainers].style.width = "100%";
                    allItemsInContainer[subContainers].style.height = "38.2%";
                }
            }
            var allItemsToBeSized = document.getElementById(viewIDName).querySelectorAll('.goldenRatioItem');
            for (var i = 0; i < allItemsToBeSized.length; i++)
            {
                if (i % 2)
                {
                    allItemsToBeSized[i].style.width = "100%";
                    allItemsToBeSized[i].style.height = "61.8%";
                }
                else
                {
                    allItemsToBeSized[i].style.width = "61.8%";
                    allItemsToBeSized[i].style.height = "100%";
                }
                if (i == (allItemsToBeSized.length - 1))
                {
                    allItemsToBeSized[i].style.width = "100%";
                    allItemsToBeSized[i].style.height = "100%";
                }
            }
        }
    }
    else
    {
        /**************************************/
        /***Device is taller than it is wide***/
        /**************************************/
        currentOrientation = 'PORTRAIT';
        document.getElementById('projectSprialContainer').style.outline = "0.75vh solid rgba(44, 44, 44, 1)";
        document.getElementById('projectSprialContainer').style.outlineOffset = "-1vh";
        for (var numberOfContainers = 0; numberOfContainers < allTopBodyContainers.length; numberOfContainers++)
        {
            var viewIDName = 'view' + numberOfContainers;
            allTopBodyContainers[numberOfContainers].setAttribute("id", viewIDName);
            var allItemsInContainer = document.getElementById(viewIDName).querySelectorAll('.goldenRatioContainer');
            allItemsInContainer[0].style.width = "100vw";
            allItemsInContainer[0].style.height = 100 * vh + 'px';
            portraitFlexContainerDirections[0];
            var flexDirectionReverse;
            if (allTopBodyContainers[numberOfContainers].classList.contains('reverseFlex'))
            {
                flexDirectionReverse = 2;
            }
            else
            {
                flexDirectionReverse = 0;
            }
            allItemsInContainer[0].style.flexDirection = portraitFlexContainerDirections[(0 + flexDirectionReverse)];
            for (var subContainers = 1; subContainers < allItemsInContainer.length; subContainers++)
            {
                allItemsInContainer[subContainers].style.flexDirection = portraitFlexContainerDirections[((subContainers + flexDirectionReverse) % 4)];
                if (subContainers % 2)
                {
                    allItemsInContainer[subContainers].style.width = "100%";
                    allItemsInContainer[subContainers].style.height = "38.2%";
                }
                else
                {
                    allItemsInContainer[subContainers].style.width = "38.2%";
                    allItemsInContainer[subContainers].style.height = "100%";
                }
            }
            var allItemsToBeSized = document.getElementById(viewIDName).querySelectorAll('.goldenRatioItem');
            for (var i = 0; i < allItemsToBeSized.length; i++)
            {
                if (i % 2)
                {
                    allItemsToBeSized[i].style.width = "61.8%";
                    allItemsToBeSized[i].style.height = "100%";
                }
                else
                {
                    allItemsToBeSized[i].style.width = "100%";
                    allItemsToBeSized[i].style.height = "61.8%";
                }
                if (i == (allItemsToBeSized.length - 1))
                {
                    allItemsToBeSized[i].style.width = "100%";
                    allItemsToBeSized[i].style.height = "100%";
                }
            }
        }
    }
    document.getElementById('view0').style.display = "flex";
}

function fadeOutThenIn(ID_OF_ELEMENT, FUNCTION_TO_CALL_BETWEEN_FADE)
{
    var elementToFade = document.getElementById(ID_OF_ELEMENT);
    if (elementToFade != null)
    {
        var fadeOut = true;
        var lowerOpacity = 0;
        var upperOpacity = 1;
        var opacityChange = 0.1;
        var elementOpacity = upperOpacity;

        var fadeInterval = setInterval(opacityFadeOutThenIn, 25);

        function opacityFadeOutThenIn()
        {
            if (fadeOut)
            {
                if (elementOpacity <= lowerOpacity + opacityChange)
                {
                    elementOpacity = lowerOpacity;
                    fadeOut = false;
                    if (FUNCTION_TO_CALL_BETWEEN_FADE != null)
                    {
                        FUNCTION_TO_CALL_BETWEEN_FADE();
                    }
                }
                else
                {
                    elementOpacity = elementOpacity - opacityChange;
                }
            }
            else
            {
                if (elementOpacity >= upperOpacity - opacityChange)
                {
                    elementOpacity = upperOpacity;
                    clearInterval(fadeInterval);
                }
                else
                {
                    elementOpacity = elementOpacity + opacityChange;
                }
            }
            elementToFade.style.opacity = elementOpacity;
        }
    }
}

function togglePanel(ID_OF_ELEMENT)
{
    panelIsOpen = true;
    adjustPanelPages();
    switch (ID_OF_ELEMENT)
    {
        case "mainPage":
            //View 1 is instructions
            document.getElementById("view0").style.display = "none";
            document.getElementById("view2").style.display = "none";
            document.getElementById("view3").style.display = "none";
            document.getElementById("view4").style.display = "none";
            document.getElementById("view1").style.display = "flex";
            document.getElementById("view5").style.display = "none";
            loadInstructionsPage();
            adjustCloseButton(1.5, 1.5);
            break;
        case "moisturePage":
            //View 2 is moisture info
            document.getElementById("view0").style.display = "none";
            document.getElementById("view1").style.display = "none";
            document.getElementById("view3").style.display = "none";
            document.getElementById("view4").style.display = "none";
            document.getElementById("view2").style.display = "flex";
            document.getElementById("view5").style.display = "none";
            loadPlotPage(moistureData, 1);
            adjustCloseButton(1.5, 1.5);
            break;
        case "lightPage":
            //View 3 is light info
            document.getElementById("view0").style.display = "none";
            document.getElementById("view1").style.display = "none";
            document.getElementById("view2").style.display = "none";
            document.getElementById("view4").style.display = "none";
            document.getElementById("view3").style.display = "flex";
            document.getElementById("view5").style.display = "none";
            loadPlotPage(lightData, 0);
            adjustCloseButton(1.5, 1.5);
            break;
        case "settingsPage":
            //View 4 is settings
            document.getElementById("view0").style.display = "none";
            document.getElementById("view1").style.display = "none";
            document.getElementById("view2").style.display = "none";
            document.getElementById("view3").style.display = "none";
            document.getElementById("view4").style.display = "flex";
            document.getElementById("view5").style.display = "none";
            loadSettingsPage();
            adjustCloseButton(1.5, 1.5);
            break;
        case "moreSettingsPage":
            //View 5 is more settings
            document.getElementById("view0").style.display = "none";
            document.getElementById("view1").style.display = "none";
            document.getElementById("view2").style.display = "none";
            document.getElementById("view3").style.display = "none";
            document.getElementById("view4").style.display = "none";
            document.getElementById("view5").style.display = "flex";
            loadSettingsPage();
            adjustCloseButton(1.5, 1.5);
            break;
        default:
            break;
    }
}

function closePanels()
{
    if (panelIsOpen)
    {
        clearChart();
        document.getElementById("view0").style.display = "flex";
        document.getElementById("view1").style.display = "none";
        document.getElementById("view2").style.display = "none";
        document.getElementById("view3").style.display = "none";
        document.getElementById("view4").style.display = "none";
        document.getElementById("view5").style.display = "none";
    }
    // if (settingsNeedToBeSaved)
    // {
    //     saveSettings();
    // }
}

function readSettingsFile()
{
    var xhr;
    var settingsArray;
    if (window.XMLHttpRequest)
    {
        xhr = new XMLHttpRequest();
    }
    else if (window.ActiveXObject)
    {
        xhr = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xhr.onreadystatechange = function()
    {
        settingsArray = xhr.responseText.split(',');
        for (var i = 0; i < settingsArray.length; i++)
        {
            settingsArray[i] = settingsArray[i].substring(2);
        }
        plantName = settingsArray[0];
        waterThreshold = settingsArray[1];
        sunExposure = settingsArray[2];
        batteryThreshold = settingsArray[3];
        silentMode = settingsArray[4];
    };
    xhr.open("GET", "../savedSettings.txt");
    xhr.send();
}

function readMoistureDataFile()
{
    var xhr;
    if (window.XMLHttpRequest)
    {
        xhr = new XMLHttpRequest();
    }
    else if (window.ActiveXObject)
    {
        xhr = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xhr.onreadystatechange = function()
    {
        moistureData = xhr.responseText;
    };
    xhr.open("GET", "../measuredData/moistureData.txt");
    xhr.send();
}

function readLightDataFile()
{
    var xhr;
    if (window.XMLHttpRequest)
    {
        xhr = new XMLHttpRequest();
    }
    else if (window.ActiveXObject)
    {
        xhr = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xhr.onreadystatechange = function()
    {
        lightData = xhr.responseText;
    };
    xhr.open("GET", "../measuredData/lightData.txt");
    xhr.send();
}

function adjustPanelPages()
{
    var allPanelContainers = document.getElementsByClassName("goldenRatioPanel");
    for (var i = 0; i < allPanelContainers.length; i++)
    {
        allPanelContainers[i].style.height = 100 * vh + "px";
    }
}

function loadPlotPage(DATA_ARRAY, MOISTURE_OR_LIGHT)
{
    var vScaled = scaleTextLandscapePortrait();
    var splitDataArray = DATA_ARRAY.split("\n");
    var lengthOfSplitDataArray = splitDataArray.length;
    var arrayOfXAxisLabels = '';

    Chart.defaults.font.family = 'indieflower';
    Chart.defaults.color = 'rgba(255,255,255,1)';
    Chart.defaults.font.size = 5 * vScaled;
    Chart.defaults.elements.point.radius = 0;
    Chart.defaults.plugins.tooltip.enabled = false;

    var ctx;
    var ctxLabel = '';
    var ctxBackgroundColor = '';
    var ctxBorderColor = '';
    var ctxTitle = '';
    var ctxNumberOfSamples;
    var ctxYMaxRange;
    var ctxYLabel = '';
    if (MOISTURE_OR_LIGHT)
    {
        ctx = document.getElementById('moisturePlot').getContext('2d');
        ctxLabel = 'moisture %';
        ctxBackgroundColor = 'rgba(114,191,255,0.85)';
        ctxBorderColor = 'rgba(114,191,255,0)';
        ctxGridColor = 'rgba(114,191,255,0.4)';
        ctxTitle = 'moisture';
        ctxNumberOfSamples = 96;
        ctxXLabel = "hours ago";
        ctxYLabel = "water %";
        ctxYMaxRange = 100;

        splitDataArray = splitDataArray.slice((-ctxNumberOfSamples - 1), -1);
        for (var i = splitDataArray.length; i > 0; i--)
        {
            arrayOfXAxisLabels += i + 'h,';
        }
        ctxXTicksLabels = arrayOfXAxisLabels.split(',');
        ctxXTicksLabels = ctxXTicksLabels.slice(0, -1);

        myChart = new Chart(ctx,
        {
            type: 'line',
            data:
            {
                labels: ctxXTicksLabels,
                datasets: [
                {
                    label: ctxLabel,
                    data: splitDataArray,
                    fill: true,
                    backgroundColor: function(context)
                    {
                        const chart = context.chart;
                        const
                        {
                            ctx,
                            chartArea
                        } = chart;
                        if (!chartArea)
                        {
                            return null;
                        }
                        return getGradient(ctx, chartArea, MOISTURE_OR_LIGHT);
                    },
                    borderColor: ctxBorderColor,
                    tension: 0.1
                }]
            },
            options:
            {
                responsive: true,
                maintainAspectRatio: false,
                plugins:
                {
                    legend:
                    {
                        display: false
                    },
                    title:
                    {
                        display: true,
                        text: ctxTitle,
                        position: 'top',
                        padding:
                        {
                            bottom: 1.5 * vScaled,
                            top: 3 * vScaled,
                        },
                        font:
                        {
                            size: 8 * vScaled
                        }
                    }
                },
                elements:
                {
                    line:
                    {
                        borderWidth: 3,
                    }
                },
                scales:
                {
                    x:
                    {
                        title:
                        {
                            display: true,
                            text: ctxXLabel,
                            padding:
                            {
                                top: -2 * vScaled,
                            }
                        },
                        grid:
                        {
                            display: true,
                            borderWidth: 0,
                            lineWidth: 3,
                            color: ctxGridColor,
                        },
                        ticks:
                        {
                            display: true,
                            autoSkip: true,
                            maxTicksLimit: 4,
                            maxRotation: 0,
                        },
                        max: ctxNumberOfSamples,
                    },
                    y:
                    {
                        title:
                        {
                            display: false,
                            text: ctxYLabel,
                            padding:
                            {
                                bottom: -3 * vScaled,
                            }
                        },
                        grid:
                        {
                            display: true,
                            borderWidth: 0,
                            lineWidth: 3,
                            color: ctxGridColor,
                        },
                        ticks:
                        {
                            align: 'start',
                            mirror: true,
                            display: true,
                            beginAtZero: false,
                            stepSize: 25,
                            z: 1,
                            padding: 1.5 * vScaled,
                            callback: function(value, index, values)
                            {
                                if (MOISTURE_OR_LIGHT)
                                {
                                    if (value < 10)
                                    {
                                        return ''
                                    }
                                    return value + "%"
                                }
                                else
                                {
                                    if (value == 100)
                                    {
                                        return 'full sun'
                                    }
                                    else if (value >= 75)
                                    {
                                        return 'partial sun'
                                    }
                                    else if (value >= 50)
                                    {
                                        return 'partial shade'
                                    }
                                    else if (value >= 25)
                                    {
                                        return 'full shade'
                                    }
                                    else
                                    {
                                        return ''
                                    }
                                }
                            }
                        },
                        min: 0,
                        max: ctxYMaxRange,
                    }
                }
            }
        });
    }
    else
    {
        ctx = document.getElementById('lightPlot').getContext('2d');
        ctxLabel = 'light %';
        ctxBackgroundColor = 'rgba(255,187,51,0.85)';
        ctxGridColor = 'rgba(255,187,51,0.4)';
        ctxBorderColor = 'rgba(255,187,51,0)';
        ctxTitle = 'light';
        ctxNumberOfSamples = 24;
        ctxYMaxRange = 10;
        ctxXLabel = "24 hours";
        ctxXLabel = "hours ago";
        ctxYLabel = "sun light %";
        ctxXTicksLabelsString = '';
        ctxXTicksLabels = '';

        var sunlightSplit = [0, 0, 0, 0, 0];
        splitDataArray = splitDataArray.slice((-ctxNumberOfSamples - 1), -1);
        lengthOfSplitDataArray = splitDataArray.length;
        for (var i = 0; i < lengthOfSplitDataArray; i++)
        {
            var compareVal = parseInt(splitDataArray[i]);
            if (compareVal == 100)
            {
                sunlightSplit[0]++;
            }
            else if (compareVal >= 75)
            {
                sunlightSplit[1]++;
            }
            else if (compareVal >= 50)
            {
                sunlightSplit[2]++;
            }
            else if (compareVal >= 25)
            {
                sunlightSplit[3]++;
            }
            else
            {
                sunlightSplit[4]++;
            }
        }
        ctxYMaxRange = Math.max(...sunlightSplit);
        ctxYMaxRange = 5 - (ctxYMaxRange % 5) + ctxYMaxRange;
        myChart = new Chart(ctx,
        {
            type: 'bar',
            data:
            {
                labels: [
                    'full sun',
                    'partial sun',
                    'partial shade',
                    'full shade',
                    'darkness'
                ],
                datasets: [
                {
                    data: sunlightSplit,
                    backgroundColor: [
                        'rgba(255,235,51,0.8)',
                        'rgba(255,225,51,0.7)',
                        'rgba(255,215,51,0.6)',
                        'rgba(255,205,51,0.5)',
                        'rgba(255,195,51,0.4)'
                    ]
                }]
            },
            options:
            {
                responsive: true,
                maintainAspectRatio: false,
                plugins:
                {
                    legend:
                    {
                        display: false
                    },
                    title:
                    {
                        display: true,
                        text: ctxTitle,
                        position: 'top',
                        padding:
                        {
                            bottom: 1.5 * vScaled,
                            top: 3 * vScaled,
                        },
                        font:
                        {
                            size: 8 * vScaled
                        }
                    }
                },
                elements:
                {
                    line:
                    {
                        borderWidth: 3,
                    }
                },
                scales:
                {
                    x:
                    {
                        title:
                        {
                            display: false,
                            text: ctxXLabel,
                            padding:
                            {
                                top: -2 * vScaled,
                            }
                        },
                        grid:
                        {
                            display: false,
                            borderWidth: 0,
                            lineWidth: 3,
                            color: ctxGridColor,
                        },
                        ticks:
                        {
                            align: 'start',
                            display: true,
                            autoSkip: false,
                        },
                    },
                    y:
                    {
                        title:
                        {
                            display: true,
                            text: "hours per day",
                            padding:
                            {
                                bottom: -1 * vScaled,
                            }
                        },
                        grid:
                        {
                            display: true,
                            borderWidth: 0,
                            lineWidth: 3,
                            color: ctxGridColor,
                        },
                        ticks:
                        {
                            align: 'start',
                            mirror: false,
                            display: true,
                            beginAtZero: false,
                            z: 1,
                            padding: 1.5 * vScaled,
                        },
                        max: ctxYMaxRange,
                    }
                }
            }

        });
    }
    chartWasCreated = true;
}

function getGradient(ctx, chartArea, MOISTURE_OR_LIGHT)
{
    var width;
    var height;
    var gradient;
    const chartWidth = chartArea.right - chartArea.left;
    const chartHeight = chartArea.bottom - chartArea.top;
    if (gradient === null || width !== chartWidth || height !== chartHeight)
    {
        width = chartWidth;
        height = chartHeight;
        gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        if (MOISTURE_OR_LIGHT)
        {
            gradient.addColorStop(0, 'rgba(114,191,255,0.8)');
            gradient.addColorStop(0.5, 'rgba(114,191,255,0.65)');
            gradient.addColorStop(1, 'rgba(114,191,255,0.5)');
        }
        else
        {
            gradient.addColorStop(0, 'rgba(255,167,51,0.5)');
            gradient.addColorStop(0.5, 'rgba(255,187,51,0.7)');
            gradient.addColorStop(1, 'rgba(255,235,51,0.9)');
        }
    }

    return gradient;
}

function clearChart()
{
    if (chartWasCreated)
    {
        chartWasCreated = false;
        myChart.destroy();
    }
}

function loadInstructionsPage()
{
    var instructionsHTML = '';
    instructionsHTML += 'hi there! my name is ' + plantName + ',<br>and this webpage is how you can monitor my wellbeing!'
    instructionsHTML += '<div class="closePanelButton" onclick="closePanels()"></div>'
    document.getElementById('instructionsPanel').innerHTML = instructionsHTML;
    document.getElementById('instructionsPanel').style.fontSize = 6.5 * vh + "px";
    document.getElementById("instructionsPanel").style.paddingTop = 5 * vw + 2.5 * vh + "px";
}

function loadSettingsPage()
{
    var vScaled = scaleTextLandscapePortrait();
    var numberOfSettingElements = 7;
    var settingsContainerElementWidth = 0;
    var inputTextHeight = 0;
    var inputTextTextSize = 0;
    var inputLabelContainerHeight = 0;
    var inputLabelContainerTextSize = 0;
    var inputSliderThumbSize = 0;
    var inputSelectorHeight = 0;
    var inputSelectorFontSize = 0;

    if ((window.innerWidth > window.innerHeight))
    {
        settingsContainerElementWidth = 50 * vw;
        settingsContainerElementHeight = (100 / numberOfSettingElements) * 1.5 * vh;
        inputTextHeight = (100 / numberOfSettingElements) * 0.5 * vh;
        inputTextTextSize = ((100 / numberOfSettingElements) * 0.35) * vh;
        inputSliderTextSize = ((100 / numberOfSettingElements) * 0.3) * vh;
        inputSliderTextHeight = ((100 / numberOfSettingElements) * 0.4) * vh;
        inputLabelContainerHeight = ((100 / numberOfSettingElements) * 0.5) * vh;
        inputLabelContainerTextSize = ((100 / numberOfSettingElements) * 0.5) * vh;
        inputSliderThumbSize = ((100 / numberOfSettingElements) * 0.4) * vh;
        inputSelectorHeight = ((100 / numberOfSettingElements) * 0.4) * vh;
        inputSelectorFontSize = ((100 / numberOfSettingElements) * 0.3) * vh;
    }
    else
    {
        settingsContainerElementWidth = 90 * vw;
        settingsContainerElementHeight = (100 / numberOfSettingElements) * 1.5 * vh;
        inputTextHeight = (100 / numberOfSettingElements) * 0.5 * vh;
        inputTextTextSize = ((100 / numberOfSettingElements) * 0.25) * vh;
        inputSliderTextSize = ((100 / numberOfSettingElements) * 0.25) * vh;
        inputSliderTextHeight = ((100 / numberOfSettingElements) * 0.4) * vh;
        inputLabelContainerHeight = ((100 / numberOfSettingElements) * 0.5) * vh;
        inputLabelContainerTextSize = ((100 / numberOfSettingElements) * 0.4) * vh;
        inputSliderThumbSize = ((100 / numberOfSettingElements) * 0.4) * vh;
        inputSelectorHeight = ((100 / numberOfSettingElements) * 0.4) * vh;
        inputSelectorFontSize = ((100 / numberOfSettingElements) * 0.3) * vh;
    }
    var allTextInputContainers = document.getElementsByClassName("inputSettingsContainer");
    for (var i = 0; i < allTextInputContainers.length; i++)
    {
        allTextInputContainers[i].style.width = settingsContainerElementWidth + "px";
        allTextInputContainers[i].style.height = settingsContainerElementHeight + "px";
    }
    var allTextInputElements = document.getElementsByClassName("inputTextElement");
    for (var i = 0; i < allTextInputElements.length; i++)
    {
        allTextInputElements[i].style.height = inputTextHeight + "px";
        allTextInputElements[i].style.fontSize = inputTextTextSize + "px";
    }
    var allInputLabelElements = document.getElementsByClassName("inputLabelContainer");
    for (var i = 0; i < allInputLabelElements.length; i++)
    {
        allInputLabelElements[i].style.width = settingsContainerElementWidth + "px";
        allInputLabelElements[i].style.height = inputLabelContainerHeight + "px";
        allInputLabelElements[i].style.fontSize = inputLabelContainerTextSize + "px";
    }
    var allSliderTextInputElements = document.getElementsByClassName("inputRangeSliderText");
    for (var i = 0; i < allSliderTextInputElements.length; i++)
    {
        allSliderTextInputElements[i].style.fontSize = inputSliderTextSize + "px";
        allSliderTextInputElements[i].style.height = inputSliderTextHeight + "px";
    }

    var allSettingButtonElements = document.getElementsByClassName("settingButtonUniversal");
    for (var i = 0; i < allSettingButtonElements.length; i++)
    {
        allSettingButtonElements[i].style.width = settingsContainerElementWidth * 0.5 + "px";
    }
    document.getElementById("settingsPanel").style.paddingTop = 2.5 * vh + "px";
    document.getElementById("moreSettingsPanel").style.paddingTop = 2.5 * vh + "px";

    var allSliderInputElements = document.getElementsByClassName("inputRangeSlider");
    for (var i = 0; i < allSliderInputElements.length; i++)
    {
        allSliderInputElements[i].style.setProperty('--sliderThumbHeight', inputSliderThumbSize + 'px');
        allSliderInputElements[i].style.setProperty('--sliderThumbWidth', inputSliderThumbSize + 'px');
        allSliderInputElements[i].style.setProperty('--sliderThumbRadius', inputSliderThumbSize + 'px');
    }
    var allSelectorInputElements = document.getElementsByClassName("inputSelectorContainer");
    for (var i = 0; i < allSelectorInputElements.length; i++)
    {
        allSelectorInputElements[i].style.marginTop = 2.5 * vh + "px";
        allSelectorInputElements[i].style.height = inputSelectorHeight + "px";
        allSelectorInputElements[i].style.fontSize = inputSelectorFontSize + "px";
    }

    document.getElementById("plantNameInput").placeholder = plantName;

    document.getElementById("sunExposureSelect").selectedIndex = sunExposure;
    updateSelect(parseInt(sunExposure));

    document.getElementById("waterThresholdSlider").value = parseInt(waterThreshold);
    updateSliderText("waterThresholdSlider", parseInt(waterThreshold));

    document.getElementById("batteryThresholdSlider").value = parseInt(batteryThreshold);
    updateSliderText("batteryThresholdSlider", parseInt(batteryThreshold));

    updateSilentModeButton();

    document.documentElement.style.setProperty('--elementBorderRadius', 1 * vScaled + "px");

    settingsNeedToBeSaved = true;
}

function updateSilentModeButton()
{
    if (silentMode == "1")
    {
        document.getElementById("enableSilentModeButton").innerHTML = "enabled";
        document.getElementById("enableSilentModeButton").style.background = 'rgba(124, 169, 247, 1)';
    }
    else
    {
        document.getElementById("enableSilentModeButton").innerHTML = "disabled";
        document.getElementById("enableSilentModeButton").style.background = 'rgba(88,88,88,1)';
    }
}

function updateNameText(UPDATED_TEXT)
{
    if (UPDATED_TEXT == "")
    {
        plantName = 'planty mcplantface';
    }
    else
    {
        plantName = UPDATED_TEXT;
    }

}

function updateSliderText(SLIDER_ID, UPDATED_VALUE)
{
    switch (SLIDER_ID)
    {
        case "waterThresholdSlider":
            var wasterThresholdPhrase = UPDATED_VALUE + '% - ';
            waterThreshold = parseInt(UPDATED_VALUE);
            if (waterThreshold >= 80)
            {
                wasterThresholdPhrase += 'drowning';
            }
            else if (waterThreshold >= 60)
            {
                wasterThresholdPhrase += 'very wet';
            }
            else if (waterThreshold >= 40)
            {
                wasterThresholdPhrase += 'moist';
            }
            else if (waterThreshold >= 20)
            {
                wasterThresholdPhrase += 'a little dry';
            }
            else
            {
                wasterThresholdPhrase += 'very dry';
            }
            document.getElementById("waterThresholdSliderText").innerHTML = wasterThresholdPhrase;
            break;
        case "batteryThresholdSlider":
            document.getElementById("batteryThresholdSliderText").innerHTML = UPDATED_VALUE + "%";
            batteryThreshold = parseInt(UPDATED_VALUE);
            break;
        default:
            break;
    }
}

function updateSelect(SELECT_VALUE)
{
    var selectBackgroundColor = '';
    switch (SELECT_VALUE)
    {
        case 0:
        case "fullsun":
            selectBackgroundColor = 'rgba(255, 235, 51, 1)';
            sunExposure = 0;
            break;
        case 1:
        case "partialsun":
            selectBackgroundColor = 'rgba(242, 223, 48, 1)';
            sunExposure = 1;
            break;
        case 2:
        case "partialshade":
            selectBackgroundColor = 'rgba(230, 211, 46, 1)';
            sunExposure = 2;
            break;
        case 3:
        case "fullshade":
            selectBackgroundColor = 'rgba(217, 200, 43, 1)';
            sunExposure = 3;
            break;
        default:
            break;
    }
    document.getElementById("sunExposureSelect").style.background = selectBackgroundColor;
}

function adjustCloseButton(SHIFT_X, SHIFT_Y)
{
    var vScaled = scaleTextLandscapePortrait();
    var allCloseButtons = document.getElementsByClassName("closePanelButton");
    for (var i = 0; i < allCloseButtons.length; i++)
    {
        allCloseButtons[i].style.width = 5 * vScaled + "px";
        allCloseButtons[i].style.height = 5 * vScaled + "px";
        allCloseButtons[i].style.top = SHIFT_Y + "vh";
        allCloseButtons[i].style.right = SHIFT_X + "vh";
    }
}

function calibrateSensor(SENSOR_TYPE)
{
    switch (SENSOR_TYPE)
    {
        case 'moisture':
            websock.send("calibrate");
            break;
        default:
            break;
    }
}

function silentModeButton()
{
    if (silentMode == '1')
    {
        silentMode = '0';
    }
    else
    {
        silentMode = '1';
    }
    updateSilentModeButton();
}

function websocketStart()
{
    websock = new WebSocket('ws://' + window.location.hostname + '/ws');
    websock.onopen = function(evt)
    {
        websockIsOpen = true;
        console.log('websock open');
    };
    websock.onclose = function(evt)
    {
        websockIsOpen = false;
        console.log('websock close');
    };
    websock.onerror = function(evt)
    {
        console.log(evt);
    };
    websock.onmessage = function(evt)
    {
        console.log(evt);
    };
}

function saveSettings()
{
    stringToSave = ''
    stringToSave += 'n:' + plantName + ',';
    stringToSave += 'w:' + waterThreshold + ',';
    stringToSave += 's:' + sunExposure + ',';
    stringToSave += 'b:' + batteryThreshold + ',';
    stringToSave += 'm:' + silentMode + ',';
    stringToSave += '.';
    websock.send(stringToSave);
    window.alert('Settings saved!');
    console.log(stringToSave);
    // if (websockIsOpen)
    // {
    //     websock.send(stringToSave);
    //     window.alert('Settings saved!');
    //     console.log(stringToSave);
    // }
    // else
    // {
    //     window.alert('No connection to save settings!');
    //     console.log(stringToSave);
    // }
}

function scaleTextLandscapePortrait()
{
    if ((window.innerWidth > window.innerHeight))
    {
        return vw;
    }
    else
    {
        return vh;
    }
}