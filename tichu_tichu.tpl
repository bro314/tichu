{OVERALL_GAME_HEADER}

<div id="mahjongpanel" class="whiteblock" style="display:none;">
    <h3>{MAHJONG}</h3>
    <div id="mahjong"></div>
</div>

<div id="phoenixpanel" class="whiteblock" style="display:none;">
    <h3>{PHOENIX}</h3>
    <div id="phoenixChoice"></div>
</div>

<div id="card-last-played-area">
    <!-- BEGIN last_played -->
    <div class="whiteblock {POSITION}" id="playertable_{PLAYER_ID}">
        <div class="last-played-container">
					<div class="last-played-player">
						<div class="playertablename" style="color:#{PLAYER_COLOR}">
							{PLAYER_NAME}
						</div>
						<div class="last-played-icons">
						  <div class="icon hand" id="icon_hand_{PLAYER_ID}"></div>
						  <div class="count handcount {PLAYER_ID}"></div>
						  <div class="icon star" id="icon_star_{PLAYER_ID}"></div>
						  <div class="count pointcount {PLAYER_ID}"></div>
						</div>
						<div>
  	          <div class="icon big grandtichucolor {PLAYER_ID}"></div>
	            <div class="icon big tichucolor {PLAYER_ID}"></div>
						</div>
					</div>
          <div id="lastcombo_{PLAYER_ID}" class="last-played-combo"></div>
        </div>
    </div>
    <!-- END last_played -->

  <div id="mahjongIndicator"></div>
  <div id="currentTrickDiv">
	  <a id="currentTrick" href="#"><div id="currentTrickCounter"></div></a>
	</div>
</div>

<div id="playertables" style="display:none;">
    <!-- BEGIN player -->
    <div>
        <div class="playertable whiteblock playertable_{DIR}" id="playertable_{PLAYER_ID}">
            <div class="playertablename" style="color:#{PLAYER_COLOR}">
                {PLAYER_NAME}
            </div>
            <div class="playertablebackground">
                <div class="tichubets">
                  <div class="icon big grandtichucolor {PLAYER_ID}"></div>
                  <div class="icon big tichucolor {PLAYER_ID}"></div>
                </div>
                <div class="playertabletext" id="playertablecard_{PLAYER_ID}" ></div>
            </div>
            <div class="receivePassCard" id="receiveplayertable_{PLAYER_ID}"></div>
            <div class="givePassCard" id="giveplayertable_{DIR}"></div>
        </div>
    </div>
    <!-- END player -->
</div>

<div id="buttons">
  <div id="play_button"></div>
  <div id="pass_button"></div>
  <div id="pass_trick_button"></div>
  <div id="space"></div>
  <div id="bomb_button"></div>
  <div id="tichu_button"></div>
</div>

<div id="myhandwrap">
    <div id="myhand">
    </div>
    <div id="prefs">
		  <span>User Preferences:</span>
      <a href="#" class="reordercards" id="order_by_rank" style="display:none;">[{REORDER_CARDS_BY_RANK}]</a>
      <a href="#" class="reordercards" id="order_by_color">[{REORDER_CARDS_BY_COLOR}]</a>
		  <a href="#" class="reordercards" id="list_table" style="display:none;">[{LIST_TABLE}]</a>
      <a href="#" class="reordercards" id="square_table">[{SQUARE_TABLE}]</a>
      <a href="#" class="reordercards" id="clockwise">[{CLOCKWISE}]</a>
      <a href="#" class="reordercards" id="counterClockwise">[{COUNTER_CLOCKWISE}]</a>
    </div>
</div>
<div id="placeholder" style="position:absolute; left:800px; top:250px; width:1px; height:1px"></div>

<script type="text/javascript">


// Javascript HTML templates


var jstpl_player_board = '<div class="ha_board">\
    <div class="icon hand"></div>&#x00D7<span class="count handcount ${id}">0</span>\
    <div class="icon star"></div>&#x00D7<span class="count pointcount ${id}" id="pointcount_${id}">0</span>\
    <div class="icon grandtichublack ${id}"></div>\
    <div class="icon grandtichucolor ${id}"></div>\
    <div class="icon tichublack ${id}"></div>\
    <div class="icon tichucolor ${id}"></div>\
    <div class="icon firstoutcolor"  id="firstoutcolor_${id}"></div>\
    <div class="icon cardback" id="cardback_${id}" ></div>\
    </div>';

var jstpl_combo = '<div id="combo_${combo_id}" class="combo">\
    <div class="comboplayer">${player_name}</div>\
    <div id="combocards_${combo_id}" class="combocards"></div>\
    </div>';


var jstpl_cardontable = '<div class="cardontable" id="cardontable_${player_id}_${card_id}" style="background-position:-${x}px -${y}px">\
                        </div>';

var jstpl_mahjong='<div class="mahjong" id="mahjong_${value}" style="background-position:-${x}px -${y}px"></div>';
var jstpl_cardback='<div class="icon cardback ${id}"></div>';
var jstpl_temp='<div id="temp_${id}" class="icon temp ${clazz}"></div>'

var jstpl_my_action_button = '<a href="#" class="action-button ${addclass}" onclick="return false;" id="${id}">${label}</a>';

var jstpl_my_hand = '<h3>{MY_HAND}</h3>'
var jstpl_auto_collect = '<h3>{AUTO_COLLECT}</h3>'
var jstpl_auto_accept = '<h3>{AUTO_ACCEPT}</h3>'

</script>

{OVERALL_GAME_FOOTER}