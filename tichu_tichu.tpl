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
        <div style="display:flex">
					<div style="min-width:150px">
						<div  class="playertablename" style="color:#{PLAYER_COLOR}">
							{PLAYER_NAME}
						</div>
						<div class="icon hand" id="icon_hand_{PLAYER_ID}"></div>x
						<span class="count handcount {PLAYER_ID}"></span>
						<br>
	          <div class="icon big grandtichucolor {PLAYER_ID}"></div>
	          <div class="icon big tichucolor {PLAYER_ID}"></div>
					</div>
          <div id="lastcombo_{PLAYER_ID}" style="flex-grow:1"></div>
        </div>
    </div>
    <!-- END last_played -->
</div>

<div id="playertables"  style="display:none;">
    <!-- BEGIN player -->
    <div style="display: inline-block">
        <div class="playertable whiteblock playertable_{DIR}" id="playertable_{PLAYER_ID}">
            <div class="playertablename" style="color:#{PLAYER_COLOR}">
                {PLAYER_NAME}
            </div>
            <div style="height:0px"><div class="playertabletext" id="playertablecard_{PLAYER_ID}" ></div></div>
            <div class="receivePassCard" id="receiveplayertable_{PLAYER_ID}"></div>
            <div class="givePassCard" id="giveplayertable_{DIR}"></div>
        </div>
    </div>
    <!-- END player -->
</div>

<div id="myhandwrap">
    <h3>{MY_HAND}
    <a href="#" class="reordercards" id="order_by_rank" style="display:none;">[{REORDER_CARDS_BY_RANK}]</a>
    <a href="#" class="reordercards" id="order_by_color">[{REORDER_CARDS_BY_COLOR}]</a>
		<a href="#" class="reordercards" id="list_table" style="display:none;">[{LIST_TABLE}]</a>
    <a href="#" class="reordercards" id="square_table">[{SQUARE_TABLE}]</a>
    <a href="#" class="reordercards" id="clockwise">[{CLOCKWISE}]</a>
    <a href="#" class="reordercards" id="counterClockwise" style="display:none;">[{COUNTER_CLOCKWISE}]</a>
    </h3>
    <div id="myhand">
    </div>
</div>
<div id="placeholder" style="position:absolute; left:800px; top:250px; width:1px; height:1px"></div>

<div id="mahjongIndicator"></div>
<div id="mahjongTikiIndicator"></div>
<a id="currentTrick" href="#"><div id="currentTrickCounter"></div></a>

<script type="text/javascript">


// Javascript HTML templates


var jstpl_player_board = '<div class="ha_board">\
    <div class="icon hand"></div>&#x00D7<span class="count handcount ${id}">0</span>\
    <div class="icon star"></div>&#x00D7<span class="count pointcount" id="pointcount_${id}">0</span>\
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

var jstpl_tikicardontable = '<div class="tikicardontable" id="cardontable_${player_id}_${card_id}" style="background-position:-${x}px -${y}px">\
                        </div>';

var jstpl_mahjong='<div class="mahjong" id="mahjong_${value}" style="background-position:-${x}px -${y}px"></div>';
var jstpl_cardback='<div class="icon cardback ${id}"></div>';
var jstpl_temp='<div id="temp_${id}" class="icon temp ${clazz}"></div>'

</script>

{OVERALL_GAME_FOOTER}