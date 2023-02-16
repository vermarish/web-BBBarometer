
/**
 * scrollVis - encapsulates
 * all the code for the visualization
 * using reusable charts pattern:
 * http://bost.ocks.org/mike/chart/
 */
 var scrollVis = function () {
  // constants to define the size
  // and margins of the vis area.
  var width = 600;
  var height = 520;
  var margin = { top: 10, left: 50, bottom: 30, right: 50 };
  // TODO margin don't matter??

  // Keep track of which visualization
  // we are on and which was the last
  // index activated. When user scrolls
  // quickly, we want to call all the
  // activate functions that they pass.
  var lastIndex = -1;
  var activeIndex = 0;

  // Sizing for the grid visualization
  var squareSize = 6;
  var squarePad = 2;
  var numPerRow = width / (squareSize + squarePad);

  // main svg used for visualization
  var svg = null;

  // d3 selection that will be used
  // for displaying visualizations
  var g = null;

  var video = document.getElementById('video');

  // subContainers for quicker selections
  var touchesContainer = null;

  // We will set the domain when the
  // data is processed.
  var xBarScale = d3.scaleLinear()
    .range([0, width]);


  // The histogram display shows the
  // first 30 minutes of data
  // so the range goes from 0 to 30
  var xHistScale = d3.scaleLinear()
    .domain([0, 30])
    .range([0, width - 20]);

  var yHistScale = d3.scaleLinear()
    .range([height, 0]);

  var t_open = null;
  var t_close = null;

  var tau_open = 0;      
  var tau_close = null;  // video duration (unit: seconds)
  var delta_tau_s = null;
  var delta_tau_ms = null;

  var timeAxisScale = d3.scaleLinear()
    .domain([t_open,t_close])
    .range([width, 0]);
    
  // two timescales: F is for the start of the viz
  //                 G is for the end of the viz
  // then during the viz, we interpolate between the two.
  var gui_stretch = 30;  // should always be >> 1
  var timeScaleF = null; // TODO refactor timeScaleF to xAtStart

  var timeScaleG = null;

  // given datum's t, compute the tau for when it should enter the viz
  var t_to_tau_cross = null;

  var tau_to_p = null;

  var t_to_p = null;

  var x_reveal = 600;

  // You could probably get fancy and
  // use just one axis, modifying the
  // scale, but I will use two separate
  // ones to keep things easy.
  var xAxisBar = d3.axisBottom()
    .scale(xBarScale);

  var xAxisHist = d3.axisBottom()
    .scale(xHistScale)
    .tickFormat(function (d) { return d + ' min'; });

  var timeAxisScroll = d3.axisBottom()
    .scale(timeAxisScale);

  // When scrolling to a new section, the activation function 
  // for that section is called.
  var activateFunctions = [];
  // If a section has an update function, then it is continuously
  // called while scrolling through.
  var updateFunctions = [];

  /**
   * chart
   *
   * @param selection - the current d3 selection(s)
   *  to draw the visualization in. For this
   *  example, we will be drawing it in #vis
   */
  var chart = function (selection) {
    selection.each(function (rawData) {
      // create svg and give it a width and height
      // svg = d3.select(this).selectAll('svg').data([wordData]);

      // TODO not sure why data should be bound here
      svg = d3.select(this).selectAll('svg').data([rawData]);

      var svgE = svg.enter().append('svg');
      // @v4 use merge to combine enter and existing selection
      svg = svg.merge(svgE);

      svg.attr('width', width + margin.left + margin.right);
      svg.attr('height', height + margin.top + margin.bottom);

      svg.append('g');


      // this group element will be used to contain all
      // other elements.
      g = svg.select('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      // ALL DATA PRE-COMPUTATIONS FOLLOW HERE
      var touchData = rawData.touch_times;
      t_open = rawData.t_open[0];
      t_close = rawData.t_close[0];
      tau_close = rawData.tau_close[0];
      delta_tau_s = tau_close - tau_open;
      delta_tau_ms = delta_tau_s*1000;

      // build all of our conversion functions using t_open, t_close
      timeScaleF = d3.scaleLinear()  // TODO refactor timeScaleF to xAtStart
      .domain([t_open, t_close])
      .range([width, width*(1+gui_stretch)]);

      timeScaleG = d3.scaleLinear()
      .domain([t_open, t_close])
      .range([width*(1-gui_stretch), width]);

      t_to_tau_cross = d3.scaleLinear()
      .domain([t_open, t_close])
      .range([tau_open,tau_close]);

      t_to_p = d3.scaleLinear()
      .domain([t_open, t_close])
      .range([0,1]);

      tau_to_p = d3.scaleLinear()
      .domain([tau_open, tau_close])
      .range([0,1]);
      

      // pre-compute initial and ending x points using functions F and G
      var x_totalWidth = width*gui_stretch;
      for (i = 0; i < touchData.length; i++) {
        d = touchData[i];
        var t = d.time;
        d.x_start = t_to_p(t)*x_totalWidth + width;
        d.x_end = d.x_start - x_totalWidth;
        var p_reveal = (d.x_start - x_reveal)/(x_totalWidth);
        d.tau_reveal = p_reveal*delta_tau_s;  // range [0,tau_close]
        d.check = xScaleH(touchData[i], tau_to_p(d.tau_reveal));
        d.id = i;
      }


      var i=0;
      d = touchData[i];
      var t = d.time;
      d.x_start = t_to_p(t)*x_totalWidth + width;
      d.x_end = d.x_start - x_totalWidth;
      var p_reveal = (d.x_start - x_reveal)/(x_totalWidth);
      console.log(delta_tau_s);
      d.tau_reveal = p_reveal*delta_tau_s;  // range [0,tau_close]
      d.check = xScaleH(touchData[i], tau_to_p(d.tau_reveal));
      d.id = i;
      console.log(d);

      console.log(rawData);
      console.log(touchData);


      setupVis(touchData);

      setupSections();
    });
  };


  /**
   * setupVis - creates initial elements for all
   * sections of the visualization.
   *
   * @param wordData - data object for each word.
   * @param fillerCounts - nested data that includes
   *  element for each filler word type.
   * @param histData - binned histogram data
   */
  
  var setupVis = function (touchData) {
    // count openvis title
    g.append('text')
      .attr('class', 'title openvis-title')
      .attr('x', width / 2)
      .attr('y', height / 3)
      .text('');

    g.append('text')
      .attr('class', 'sub-title openvis-title')
      .attr('x', width / 2)
      .attr('y', (height / 3) + (height / 5))
      .text('');

    g.selectAll('.openvis-title')
      .attr('opacity', 0);

    // count filler word count title
    g.append('text')
      .attr('class', 'title count-title highlight')
      .attr('x', width / 2)
      .attr('y', height / 3)
      .text('180');

    g.append('text')
      .attr('class', 'sub-title count-title')
      .attr('x', width / 2)
      .attr('y', (height / 3) + (height / 5))
      .text('Filler Words');

    g.selectAll('.count-title')
      .attr('opacity', 0);

    // SECTION 0: video
    // setup the video listeners
    video.loop = false;
    video.volume = 0;

    video.addEventListener('play', startAnimation);
    video.addEventListener('pause', function() {
      console.log("pausing?");
      if (video.currentTime == video.duration) {
        console.log("not pausing.");
        video.currentTime = 0;

        console.log("wait for it...");
        setTimeout(function() {video.play()}, 500);
        console.log("playing!");
      } else {
        console.log("pausing!");
        stopAnimation();
      }
    });
    video.addEventListener('seeking', seekToState);

    //setup

    // SECTION 0.5: gradient
    svg.append('defs')
      .html('\
      <linearGradient id="Gradient0" x1="0" x2="1" y1="0" y2="0">\
        <stop offset="0%" stop-color="white" stop-opacity="1" />\
        <stop offset="100%" stop-color="white" stop-opacity="0" />\
      </linearGradient')

    svg.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 100)
      .attr('height', 700)
      .attr('fill', 'url(#Gradient0)');

    // SECTION 1: FIRST TOUCH GRAPH    
    g.append("g")
    .attr("class", "touchesContainer")
    .attr('x', width)
    .attr('y', height/4);
    var touchesContainer = g.select(".touchesContainer");

    // horizontal line
    touchesContainer.append("line")
      .attr("x1", 0)
      .attr("y1", 120) 
      .attr("x2", width)
      .attr("y2", 120)
      .attr("style", "stroke:rgb(200,200,200);stroke-width:2");

    // vertical line
    touchesContainer.append("line")
      .attr("x1", width)
      .attr("y1", 60) 
      .attr("x2", width)
      .attr("y2", 180)
      .attr("style", "stroke:rgb(20,20,20);stroke-width:2");

    
    // initialize the circles
    var touches = touchesContainer.selectAll('.touch')
      .data(touchData, function (d) {return d.time;})
      .enter()
      .append('circle')
      .attr('id', d => d.id)
      .attr('class', 'touch')
      .attr('cx', function(d){return timeScaleF(d.time);})
      .attr('cy', 120)
      .attr('r', 20)
      .attr('fill', 'red')
      .attr('opacity', 0.8);

  };

  /**
   * setupSections - each section is activated
   * by a separate function. Here we associate
   * these functions to the sections based on
   * the section's index.
   *
   */
  var setupSections = function () {
    // first, init empty functions
    for (var i = 0; i < 9; i++) {
      activateFunctions[i] = function () {console.log(i)};
    }
    for (var i = 0; i < 9; i++) {
      updateFunctions[i] = function () {};
    }

    // activateFunctions are called each
    // time the active section changes
    activateFunctions[0] = showTitle;
    activateFunctions[1] = function() { video.play(); };
    
    

    // TODO more activateFunctions

    // updateFunctions are called while
    // in a particular section to update
    // the scroll progress in that section.
    // Most sections do not need to be updated
    // for all scrolling and so are set to
    // no-op functions.
    // TODO actual updateFunctions
  };

  /**
   * ACTIVATE FUNCTIONS
   *
   * These will be called their
   * section is scrolled to.
   *
   * General pattern is to ensure
   * all content for the current section
   * is transitioned in, while hiding
   * the content for the previous section
   * as well as the next section (as the
   * user may be scrolling up or down).
   *
   */

  /**
   * showTitle - initial title
   *
   * hides: count title
   * (no previous step to hide)
   * shows: intro title
   *
   */
  function showTitle() {
    g.selectAll('.count-title')
      .transition()
      .duration(0)
      .attr('opacity', 0);

    g.selectAll('.openvis-title')
      .transition()
      .duration(600)
      .attr('opacity', 1.0);

    g.selectAll('.x-axis, .y-axis, .singular-dot')
    .transition()
    .duration(0)
    .attr('opacity', 0);
  }

  /**
   * showFillerTitle - filler counts
   *
   * hides: intro title
   * hides: square grid
   * shows: filler count title
   *
   */
  function showFillerTitle() {
    g.selectAll('.openvis-title')
      .transition()
      .duration(0)
      .attr('opacity', 0);

    g.select('.x-axis')
      .transition()
      .duration(0)
      .attr('opacity', 1.0);

    g.select('.y-axis')
      .transition()
      .duration(0)
      .attr('opacity', 1.0);

    g.selectAll('.singular-dot')
      .transition()
      .duration(0)
      .attr('opacity', 1.0);
  }

  function moveTapsTo(p) {
    console.log("moveTapsTo()");
    var touches = g.select(".touchesContainer").selectAll('.touch');
    touches.transition()
      .ease(d3.easeLinear)
      .duration(1000)
      .attr('cx', function(d) {return xScaleH(d, p)});
  }

  function seekToState() {
    console.log("seekToState()")
    
    var tauCurr = video.currentTime;
    
    var p_from = p_tau(tauCurr);

    var touches = g.select(".touchesContainer").selectAll('.touch');
    
    // console.log(touches.data());
    

    var touchesE = touches.data(d3.select("#vis").datum()["touch_times"])
      .enter()
      .append("circle")
      .attr("class", "touch")
      .attr("id", d => d.i)
      .attr('r', 20)
      .attr('fill', 'red')
      .attr('cy', 120)
      // if it's not their turn, they'll hang off-screen
      .attr('cx', 1000);

    
    
    touches = touches.merge(touchesE);
    // touches = g.select(".touchesContainer").selectAll('.touch');  // only if the merge is flopping
    

    

    touches
      .data(d3.select("#vis").datum()["touch_times"])
      .transition()
      .duration(150)
      .ease(d3.easeLinear)
      // .attr('opacity', function(d) {return 0.2 + 0.6*(d.tau_reveal < tauCurr)})
      .attr('opacity', 0.8)
      // if it is their turn, put them where they belong
      .attr('cx', d => xScaleH(d, p_from));
  }
  
  function startAnimation() {
    /*
    first transition with computed delay, zero duration, opacity 0->1, x anywhere -> width
    then transition with same delay, duration = remaining animation, x -> end
    */

    
    

    var tau_from = video.currentTime;
    var tau_to = tau_close;

    var p_from = p_tau(tau_from);
    var p_close = p_tau(tau_close);

    
    // first bring the points to the x corresponding to tau_from
    seekToState();
    console.log("startAnimation() ");
    
    var touches = g.select(".touchesContainer").selectAll('.touch');
    
    // then bring each to the x_width when it's their turn to be revealed
    touches
      .transition()
      .attr('cx', width)
      .attr('fill', 'red')
      .delay(function(d) { return 1000*(d.tau_reveal - tau_from) })  // each datum is revealed at time tau_reveal
      .duration(0);
    
    

    // then continue the rest of the transition
    touches.transition()
      .attr('cx', function(d) {return xScaleH(d, p_close)})
      .delay(function(d) { return 1000*(d.tau_reveal - tau_from) })
      .ease(d3.easeLinear)
      .duration(function(d) { return 1000*(tau_to - d.tau_reveal) });
    

    // elements disappear after 10 seconds
    var elementRemoveDelay_s = 10;  // TODO
    touches.transition()
      .delay(function(d) { return 1000*(d.tau_reveal - tau_from + elementRemoveDelay_s) })
      .duration(0)
      .remove();   
      
  }

  function stopAnimation() {
    var touches = g.select(".touchesContainer").selectAll(".touch");
    touches.interrupt();
  }

  function moveTapsFromNew(p) {
    // TODO forget p, I should do everything in terms of tau.
    console.log("start moveTapsFromNew(" + p + ")");
    
    var center = svg.attr("width");
    
    var touches = g.select(".touchesContainer")
      .selectAll(".touch");

    // from progress p, the TOTAL animation will last delta_tau_ms*(1-p) seconds
    touches.interrupt()
      .attr('cx', function(d) {return xScaleH(d, p)})
      .transition()
      .ease(d3.easeLinear)
      .duration(function(d) {delta_tau_ms*(1-p)*p_t(d.time)})
      .attr('opacity', 1)

  }

  /**
   * Linear mapping from [tau_open, tau_close] -> [0, 1]
   *                         (seconds in video)    
   * Useful for linear combinations.
   */
  function p_tau(tau_curr) {
    return (tau_curr - tau_open) / (tau_close - tau_open);
  }

  function p_t(t_curr) {
    return (t_curr - t_open) / (t_close - t_open);
  }

  /**
   * Given a time-series datum, figure out where it belongs at the given time
   * Interpolates between a datum's x_start and x_end
   * @param {datum} d, a tuple containing time and pre-computed x_start, x_end 
   * @param {[0,1]} p_tau_curr
   */
  function xScaleH(d, p_tau_curr) {
    return d.x_start*(1-p_tau_curr) + d.x_end*(p_tau_curr);
  }

  /**
   * UPDATE FUNCTIONS
   *
   * These will be called within a section
   * as the user scrolls through it.
   *
   * We use an immediate transition to
   * update visual elements based on
   * how far the user has scrolled
   *
   */


  /**
   * DATA FUNCTIONS
   *
   * Used to coerce the data into the
   * formats we need to visualize
   *
   */
  /**
   * activate -
   *
   * @param index - index of the activated section
   */
  chart.activate = function (index) {
    activeIndex = index;
    var sign = (activeIndex - lastIndex) < 0 ? -1 : 1;
    var scrolledSections = d3.range(lastIndex + sign, activeIndex + sign, sign);
    scrolledSections.forEach(function (i) {
      activateFunctions[i]();
    });
    lastIndex = activeIndex;
  };

  /**
   * update
   *
   * @param index
   * @param progress
   */
  chart.update = function (index, progress) {
    updateFunctions[index](progress);
  };

  // return chart function
  return chart;
};


/**
 * display - called once data
 * has been loaded.
 * sets up the scroller and
 * displays the visualization.
 *
 * @param data - loaded tsv data
 */
function display(data) {
  // create a new plot and
  // display it
  var plot = scrollVis();
  d3.select('#vis')
    .datum(data)
    .call(plot);

  // setup scroll functionality
  var scroll = scroller()
    .container(d3.select('#graphic'));

  // pass in .step selection as the steps
  scroll(d3.selectAll('.step'));

  // setup event handling
  scroll.on('active', function (index) {
    // highlight current step text
    d3.selectAll('.step')
      .style('opacity', function (d, i) { return i === index ? 1 : 0.1; });

    // activate current section
    plot.activate(index);
  });

  scroll.on('progress', function (index, progress) {
    plot.update(index, progress);
  });
}

// load data and display
// d3.tsv('data/words.tsv', display);
d3.json('data/viz_data.json', display);
